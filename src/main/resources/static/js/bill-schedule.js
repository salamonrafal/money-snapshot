const schedulePageBody = document.body;
const billId = schedulePageBody?.dataset.billId ?? "";
const headingElement = document.querySelector("#bill-schedule-heading");
const subtitleElement = document.querySelector("#bill-schedule-subtitle");
const counterpartyElement = document.querySelector("#bill-schedule-counterparty");
const accountElement = document.querySelector("#bill-schedule-account");
const periodElement = document.querySelector("#bill-schedule-period");
const statusElement = document.querySelector("#bill-schedule-status");
const tableBody = document.querySelector("#bill-schedule-table-body");
const listMessage = document.querySelector("#bill-schedule-message");
const previousPageButton = document.querySelector("#bill-schedule-prev-page");
const nextPageButton = document.querySelector("#bill-schedule-next-page");
const pageInfoElement = document.querySelector("#bill-schedule-page-info");
const pageSizeSelect = document.querySelector("#bill-schedule-page-size");
const refreshButton = document.querySelector("#bill-schedule-refresh");

const toastManager = MoneySnapshotUi.createToastManager({
    durationMs: 5000
});

let messages = {};
let userSettings = null;
let currentPage = 0;
let currentPageData = null;

function formatDate(value) {
    return value ? MoneySnapshotUi.formatDateValue(value, userSettings) : "-";
}

function formatDateTime(value) {
    return value ? MoneySnapshotUi.formatDateTimeValue(value, userSettings) : "-";
}

function formatMoney(value) {
    return MoneySnapshotUi.formatMoneyValue(value, userSettings);
}

function setListMessage(text, type = "") {
    if (listMessage) {
        listMessage.textContent = text;
        listMessage.dataset.type = type;
    }

    if (!text) {
        toastManager.clear();
        return;
    }

    toastManager.show(text, {type});
}

function formatDuration(bill) {
    if (bill.durationType === "UNTIL_DATE" && bill.endDate) {
        return (messages["bills.duration.untilDate"] ?? "").replace("{date}", formatDate(bill.endDate));
    }

    if (bill.durationType === "INSTALLMENTS" && bill.installmentCount) {
        return (messages["bills.duration.installments"] ?? "").replace("{count}", String(bill.installmentCount));
    }

    return messages["bills.duration.openEnded"] ?? "";
}

function createScheduleStatusBadge(entry) {
    const badge = document.createElement("span");
    badge.className = "liability-status";
    if (entry.paid) {
        badge.classList.add("liability-status-completed");
        badge.textContent = messages["billSchedule.status.paid"] ?? "";
    } else {
        badge.classList.add("liability-status-muted");
        badge.textContent = messages["billSchedule.status.pending"] ?? "";
    }
    return badge;
}

function renderBillSummary(bill) {
    if (!bill) {
        return;
    }

    document.title = `${bill.name ?? messages["billSchedule.heading.title"]} | ${messages["app.name"]}`;
    if (headingElement) {
        headingElement.textContent = bill.name ?? messages["billSchedule.heading.title"] ?? "";
    }
    if (subtitleElement) {
        subtitleElement.textContent = (messages["billSchedule.heading.subtitle"] ?? "")
            .replace("{bill}", bill.name ?? "");
    }
    if (counterpartyElement) {
        counterpartyElement.textContent = bill.counterpartyName ?? "-";
    }
    if (accountElement) {
        accountElement.textContent = bill.accountName ?? "-";
    }
    if (periodElement) {
        periodElement.textContent = formatDuration(bill);
    }
    if (statusElement) {
        statusElement.textContent = messages[`bills.status.${bill.status}`] ?? bill.status ?? "-";
    }
}

function renderTable(content) {
    if (!tableBody) {
        return;
    }

    if (!content.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = messages["billSchedule.table.empty"] ?? "";
        row.append(cell);
        tableBody.replaceChildren(row);
        return;
    }

    tableBody.replaceChildren(...content.map((entry) => {
        const row = document.createElement("tr");

        [
            String(entry.installmentNumber ?? "-"),
            formatDate(entry.dueDate),
            formatMoney(entry.amount)
        ].forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (index === 2) {
                cell.className = "bills-amount-cell";
            }
            row.append(cell);
        });

        const statusCell = document.createElement("td");
        statusCell.append(createScheduleStatusBadge(entry));
        row.append(statusCell);

        const paidAtCell = document.createElement("td");
        paidAtCell.textContent = entry.paidAt
            ? formatDateTime(entry.paidAt)
            : (messages["billSchedule.paidAt.empty"] ?? "-");
        row.append(paidAtCell);

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "row-actions";
        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = `icon-button${entry.paid ? " secondary" : ""}`;
        const actionLabel = entry.paid
            ? (messages["billSchedule.actions.markUnpaid"] ?? "")
            : (messages["billSchedule.actions.markPaid"] ?? "");
        toggleButton.setAttribute("aria-label", actionLabel);
        MoneySnapshotUi.setTooltip(toggleButton, actionLabel);
        toggleButton.append(entry.paid ? MoneySnapshotUi.createUndoIcon() : MoneySnapshotUi.createCheckIcon());
        toggleButton.addEventListener("click", async () => {
            toggleButton.disabled = true;
            setListMessage("");
            try {
                await updateScheduleEntry(entry.id, !entry.paid);
                await loadSchedule(currentPage);
                setListMessage(messages["billSchedule.update.success"] ?? "", "success");
            } catch (error) {
                setListMessage(error.message ?? messages["billSchedule.error.update"] ?? "Request failed.", "error");
            } finally {
                toggleButton.disabled = false;
            }
        });
        actions.append(toggleButton);
        actionsCell.append(actions);
        row.append(actionsCell);

        return row;
    }));
}

function renderPagination(pageData) {
    if (!pageData) {
        if (pageInfoElement) {
            pageInfoElement.textContent = "-";
        }
        previousPageButton.disabled = true;
        nextPageButton.disabled = true;
        return;
    }

    const totalPages = Math.max(pageData.totalPages, 1);
    const template = messages["billSchedule.pagination.info"] ?? "";
    if (pageInfoElement) {
        pageInfoElement.textContent = template
            .replace("{page}", String(pageData.page + 1))
            .replace("{totalPages}", String(totalPages))
            .replace("{totalElements}", String(pageData.totalElements));
    }
    previousPageButton.disabled = pageData.first;
    nextPageButton.disabled = pageData.last;
}

async function readErrorPayload(response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
        return null;
    }

    try {
        return await response.json();
    } catch {
        return null;
    }
}

async function loadSchedule(page = currentPage) {
    const response = await fetch(
        `/api/bills/${encodeURIComponent(billId)}/schedule?page=${encodeURIComponent(page)}&size=${encodeURIComponent(pageSizeSelect.value)}`
    );
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (!response.ok) {
        throw new Error(errorPayload?.message ?? messages["billSchedule.error.load"] ?? "Cannot load bill schedule.");
    }

    currentPageData = await response.json();
    currentPage = currentPageData.page ?? 0;
    renderBillSummary(currentPageData.bill);
    renderTable(currentPageData.content ?? []);
    renderPagination(currentPageData);
}

async function updateScheduleEntry(entryId, paid) {
    const response = await fetch(`/api/bills/${encodeURIComponent(billId)}/schedule/${encodeURIComponent(entryId)}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({paid})
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (!response.ok) {
        throw new Error(errorPayload?.message ?? messages["billSchedule.error.update"] ?? "Cannot update bill schedule.");
    }

    return response.json();
}

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    MoneySnapshotUi.setTooltip(refreshButton, messages["billSchedule.actions.refresh"]);
    loadSchedule(currentPage).catch((error) => {
        console.error(error);
        setListMessage(error.message ?? messages["billSchedule.error.load"] ?? "Cannot load bill schedule.", "error");
    });
}

previousPageButton?.addEventListener("click", () => {
    if (currentPageData?.first) {
        return;
    }
    loadSchedule(Math.max(currentPage - 1, 0)).catch((error) => {
        setListMessage(error.message ?? messages["billSchedule.error.load"] ?? "Cannot load bill schedule.", "error");
    });
});

nextPageButton?.addEventListener("click", () => {
    if (currentPageData?.last) {
        return;
    }
    loadSchedule(currentPage + 1).catch((error) => {
        setListMessage(error.message ?? messages["billSchedule.error.load"] ?? "Cannot load bill schedule.", "error");
    });
});

pageSizeSelect?.addEventListener("change", () => {
    currentPage = 0;
    loadSchedule(0).catch((error) => {
        setListMessage(error.message ?? messages["billSchedule.error.load"] ?? "Cannot load bill schedule.", "error");
    });
});

refreshButton?.addEventListener("click", () => {
    setListMessage("");
    loadSchedule(currentPage).catch((error) => {
        setListMessage(error.message ?? messages["billSchedule.error.load"] ?? "Cannot load bill schedule.", "error");
    });
});

MoneySnapshotI18n.init({
    endpoint: "/api/bill-schedule/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        handleLanguageChange(nextMessages);
    }
})
    .then(() => MoneySnapshotUi.loadUserSettings())
    .then((settings) => {
        userSettings = settings;
        return loadSchedule(0);
    })
    .catch((error) => {
        console.error(error);
        setListMessage(error.message ?? "Cannot load bill schedule.", "error");
    });
