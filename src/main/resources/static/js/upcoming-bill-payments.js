const paymentsBody = document.querySelector("#payments-body");
const paymentsMessage = document.querySelector("#payments-message");
const refreshButton = document.querySelector("#payments-refresh");
const toastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});
let messages = {};
let userSettings = null;
let payments = [];
let ready = false;
let busy = false;

function showMessage(key, type = "error") {
    paymentsMessage.textContent = messages[key] ?? "";
    paymentsMessage.dataset.type = type;
    toastManager.show(messages[key] ?? "", {type});
}

function renderPayments() {
    document.title = `${messages["upcomingPayments.title"]} | ${messages["app.name"]}`;
    paymentsBody.replaceChildren();
    if (!payments.length) {
        const row = paymentsBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 6;
        cell.textContent = messages["upcomingPayments.empty"];
        return;
    }
    payments.forEach(({billId, billName, counterpartyName, accountName, payment}) => {
        const row = paymentsBody.insertRow();
        row.insertCell().textContent = MoneySnapshotUi.formatDateValue(payment.dueDate, userSettings);
        const link = document.createElement("a");
        link.href = `/bills/${encodeURIComponent(billId)}/schedule.html`;
        link.textContent = billName;
        row.insertCell().append(link);
        row.insertCell().textContent = counterpartyName;
        row.insertCell().textContent = accountName;
        const amountCell = row.insertCell();
        amountCell.className = "bills-amount-cell";
        amountCell.textContent = `${MoneySnapshotUi.formatMoneyValue(payment.amount, userSettings)} ${payment.currencyCode}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button compact";
        button.textContent = messages["billSchedule.actions.markPaid"];
        button.disabled = busy;
        button.addEventListener("click", () => markPaid(billId, payment.id));
        row.insertCell().append(button);
    });
}

async function loadPayments() {
    const response = await fetch("/api/bills/upcoming-payments");
    if (!response.ok) throw new Error("load");
    payments = await response.json();
    renderPayments();
}

async function markPaid(billId, entryId) {
    if (busy) return;
    busy = true;
    refreshButton.disabled = true;
    paymentsMessage.textContent = "";
    toastManager.clear();
    renderPayments();
    try {
        const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/schedule/${encodeURIComponent(entryId)}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({paid: true})
        });
        if (!response.ok) throw new Error("update");
        payments = payments.filter(item => item.payment.id !== entryId);
        showMessage("billSchedule.update.success", "success");
    } catch {
        showMessage("billSchedule.error.update");
    } finally {
        busy = false;
        refreshButton.disabled = false;
        renderPayments();
    }
}

refreshButton.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    renderPayments();
    refreshButton.disabled = true;
    paymentsMessage.textContent = "";
    toastManager.clear();
    try {
        await loadPayments();
    } catch {
        showMessage("billSchedule.error.load");
    } finally {
        busy = false;
        refreshButton.disabled = false;
        renderPayments();
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/bill-schedule/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        messages = nextMessages;
        document.title = `${messages["upcomingPayments.title"]} | ${messages["app.name"]}`;
        paymentsMessage.textContent = "";
        toastManager.clear();
        if (ready) renderPayments();
    }
}).then(async () => {
    userSettings = await MoneySnapshotUi.loadUserSettings();
    ready = true;
    await loadPayments();
}).catch(() => showMessage("billSchedule.error.load"));
