const liabilitiesTableBody = document.querySelector("#liabilities-table-body");
const liabilitiesSummaryActiveCount = document.querySelector("#liabilities-summary-active-count");
const liabilitiesSummaryMonthlyDue = document.querySelector("#liabilities-summary-monthly-due");
const liabilitiesSummaryCurrentDebt = document.querySelector("#liabilities-summary-current-debt");
const liabilitiesSummaryNextPayment = document.querySelector("#liabilities-summary-next-payment");
const liabilitiesListMessage = document.querySelector("#liabilities-list-message");
const newLiabilityAction = document.getElementById("new-liability-action");
const newLiabilityRepaymentAction = document.getElementById("new-liability-repayment-action");
const creditCardDebtModalElement = document.querySelector("#update-liability-credit-card-modal");
const creditCardDebtModal = MoneySnapshotUi.createModal({
    modalSelector: "#update-liability-credit-card-modal",
    closeSelectors: ["#update-liability-credit-card-modal [data-credit-card-debt-modal-close]"]
});
const creditCardDebtForm = document.getElementById("liability-credit-card-debt-form");
const creditCardDebtSummary = document.getElementById("liability-credit-card-debt-summary");
const creditCardDebtInput = document.getElementById("liability-credit-card-debt-current-amount");
const creditCardDebtMessage = document.getElementById("liability-credit-card-debt-form-message");
const creditCardDebtSubmitButton = document.getElementById("liability-credit-card-debt-submit");
const toastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});
const LIABILITIES_NOTIFICATION_KEY = "money-snapshot-liabilities-notification";
const deleteLiabilityModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-liability-modal",
    subjectSelector: "#delete-liability-name",
    confirmSelector: "#confirm-delete-liability",
    cancelSelector: "#cancel-delete-liability"
});
const deleteLiabilityRepaymentModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-liability-repayment-modal",
    subjectSelector: "#delete-liability-repayment-name",
    confirmSelector: "#confirm-delete-liability-repayment",
    cancelSelector: "#cancel-delete-liability-repayment"
});

let currentLanguage = "pl";
let liabilitiesMessages = {};
let userSettings = null;
let cachedDashboard = null;
let dashboardLoaded = false;
let selectedCreditCardLiability = null;

function setListMessage(text, type = "") {
    if (!liabilitiesListMessage) {
        return;
    }

    liabilitiesListMessage.textContent = text;
    liabilitiesListMessage.dataset.type = type;
}

function showToast(text, type = "") {
    if (!text) {
        return;
    }

    toastManager.clear();
    toastManager.show(text, {type});
}

function showPendingNotification() {
    let rawValue = "";

    try {
        rawValue = window.sessionStorage.getItem(LIABILITIES_NOTIFICATION_KEY) ?? "";
    } catch (error) {
        console.warn("Cannot access liabilities notification state", error);
        return;
    }

    if (!rawValue) {
        return;
    }

    try {
        window.sessionStorage.removeItem(LIABILITIES_NOTIFICATION_KEY);
    } catch (error) {
        console.warn("Cannot clear liabilities notification state", error);
    }

    try {
        const notification = JSON.parse(rawValue);
        const messageKey = typeof notification?.messageKey === "string" ? notification.messageKey : "";
        const type = typeof notification?.type === "string" ? notification.type : "";
        const text = liabilitiesMessages[messageKey] ?? "";
        if (text) {
            showToast(text, type);
        }
    } catch (error) {
        console.warn("Cannot parse liabilities notification state", error);
    }
}

function formatMoney(value) {
    return MoneySnapshotUi.formatMoneyValue(value ?? 0, userSettings);
}

function formatDate(value) {
    return value ? MoneySnapshotUi.formatDateValue(value, userSettings) : "-";
}

function normalizeDecimalInput(rawValue) {
    const trimmedValue = `${rawValue ?? ""}`.trim();
    if (!trimmedValue) {
        return null;
    }

    const normalizedValue = trimmedValue.replace(/\s+/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,4})?$/.test(normalizedValue)) {
        return null;
    }

    return normalizedValue;
}

function summaryValueOrDash(value, formatter = (nextValue) => nextValue) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    return formatter(value);
}

function liabilityStatusLabel(status) {
    return liabilitiesMessages[`liabilities.status.${String(status).toLowerCase()}`] ?? status;
}

function liabilityStatusClass(status) {
    if (status === "ACTIVE") {
        return "liability-status-active";
    }
    if (status === "COMPLETED") {
        return "liability-status-completed";
    }
    if (status === "SUSPENDED") {
        return "liability-status-suspended";
    }

    return "liability-status-muted";
}

function liabilityRepaymentAmount(liability) {
    if (liability.liabilityTypeCode === "CREDIT_CARD") {
        return liability.creditCardMinimumPayment;
    }

    return liability.installmentAmount ?? liability.creditCardMinimumPayment ?? liability.currentAmount;
}

function canRegisterRepayment(liability) {
    return liability?.status === "ACTIVE";
}

function createSyncDebtIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");

    [
        "M21 12a9 9 0 0 1-15.5 6.36",
        "M3 12a9 9 0 0 1 15.5-6.36",
        "M18 3v3h-3",
        "M6 21v-3h3"
    ].forEach((value) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", value);
        icon.append(path);
    });

    return icon;
}

function liabilityUpdatePayload(liability, overrides = {}) {
    return {
        name: liability.name,
        bankName: liability.bankName,
        liabilityTypeCode: liability.liabilityTypeCode,
        scheduleMode: liability.scheduleMode,
        currentAmount: overrides.currentAmount ?? liability.currentAmount,
        installmentAmount: liability.installmentAmount,
        creditCardLimit: liability.creditCardLimit,
        creditCardMinimumPayment: liability.creditCardMinimumPayment,
        repaymentStartDate: liability.repaymentStartDate,
        endDate: liability.endDate,
        installmentCount: liability.installmentCount,
        firstRepaymentDay: liability.firstRepaymentDay,
        note: liability.note ?? "",
        status: liability.status
    };
}

function setCreditCardDebtMessage(text, type = "") {
    if (!creditCardDebtMessage) {
        return;
    }

    creditCardDebtMessage.textContent = text;
    creditCardDebtMessage.dataset.type = type;
}

function openCreditCardDebtModal(liability, trigger) {
    if (!liability || liability.liabilityTypeCode !== "CREDIT_CARD") {
        return;
    }

    selectedCreditCardLiability = liability;

    if (creditCardDebtSummary) {
        creditCardDebtSummary.textContent = `${liability.name} · ${liability.bankName} · ${formatMoney(liability.currentAmount)} / ${formatMoney(liability.creditCardLimit)}`;
    }

    if (creditCardDebtInput) {
        creditCardDebtInput.value = `${liability.currentAmount ?? 0}`;
    }

    setCreditCardDebtMessage("");
    creditCardDebtModal.open({trigger});
}

function renderSummary(summary) {
    if (liabilitiesSummaryActiveCount) {
        liabilitiesSummaryActiveCount.textContent = summary?.activeCount ?? "-";
    }

    if (liabilitiesSummaryMonthlyDue) {
        liabilitiesSummaryMonthlyDue.textContent = summaryValueOrDash(summary?.monthlyDueAmount, formatMoney);
    }

    if (liabilitiesSummaryCurrentDebt) {
        liabilitiesSummaryCurrentDebt.textContent = summaryValueOrDash(summary?.currentDebtAmount, formatMoney);
    }

    if (liabilitiesSummaryNextPayment) {
        liabilitiesSummaryNextPayment.textContent = summaryValueOrDash(summary?.nextPaymentDate, formatDate);
    }
}

function renderRepaymentList(repayments) {
    const list = document.createElement("ul");
    list.className = "liability-repayments-list";

    if (!repayments || repayments.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "liability-repayment-item";
        emptyItem.style.gridColumn = "1 / -1";
        emptyItem.textContent = liabilitiesMessages["liabilities.list.emptyRepayments"] ?? "-";
        list.append(emptyItem);
        return list;
    }

    repayments.forEach((repayment) => {
        const item = document.createElement("li");
        item.className = "liability-repayment-item";

        const date = document.createElement("span");
        date.textContent = formatDate(repayment.repaymentDate);

        const amount = document.createElement("strong");
        amount.textContent = formatMoney(repayment.amount);

        const actions = document.createElement("div");
        actions.className = "row-actions liability-repayment-actions";

        const editButton = document.createElement("a");
        editButton.className = "icon-button secondary";
        editButton.href = `/liabilities/repayments/${encodeURIComponent(repayment.id)}/edit.html?returnTo=${encodeURIComponent("/liabilities.html")}`;
        editButton.setAttribute("aria-label", liabilitiesMessages["liabilities.repayments.actions.edit"] ?? "");
        MoneySnapshotUi.setTooltip(editButton, liabilitiesMessages["liabilities.repayments.actions.edit"] ?? "");
        editButton.append(MoneySnapshotUi.createEditIcon());

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.setAttribute("aria-label", liabilitiesMessages["liabilities.repayments.actions.delete"] ?? "");
        MoneySnapshotUi.setTooltip(deleteButton, liabilitiesMessages["liabilities.repayments.actions.delete"] ?? "");
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteLiabilityRepaymentModal.open(
                repayment,
                `${formatDate(repayment.repaymentDate)} · ${formatMoney(repayment.amount)}`
            );
        });

        actions.append(editButton, deleteButton);
        const noteRow = document.createElement("div");
        noteRow.className = "liability-repayment-note-row";

        const note = document.createElement("span");
        note.className = "liability-repayment-note";
        note.textContent = repayment.note || formatMoney(repayment.currentAmount);

        noteRow.append(note, actions);
        item.append(date, amount, noteRow);
        list.append(item);
    });

    return list;
}

function createActionButton(liability) {
    const actions = document.createElement("div");
    actions.className = "row-actions liability-row-actions";

    const editButton = document.createElement("a");
    editButton.className = "icon-button secondary";
    editButton.href = `/liabilities/${encodeURIComponent(liability.id)}/edit.html?returnTo=${encodeURIComponent("/liabilities.html")}`;
    editButton.setAttribute("aria-label", liabilitiesMessages["liabilities.actions.edit"] ?? "");
    MoneySnapshotUi.setTooltip(editButton, liabilitiesMessages["liabilities.actions.edit"] ?? "");
    editButton.append(MoneySnapshotUi.createEditIcon());

    const repayButton = canRegisterRepayment(liability)
        ? document.createElement("a")
        : document.createElement("button");
    repayButton.className = "icon-button secondary";
    if (canRegisterRepayment(liability)) {
        repayButton.href = `/liabilities/repayments/new.html?liabilityId=${encodeURIComponent(liability.id)}`;
    } else {
        repayButton.type = "button";
        repayButton.disabled = true;
    }
    repayButton.setAttribute(
        "aria-label",
        canRegisterRepayment(liability)
            ? (liabilitiesMessages["liabilities.actions.registerRepayment"] ?? "")
            : (liabilitiesMessages["liabilities.actions.registerRepaymentDisabled"] ?? "")
    );
    MoneySnapshotUi.setTooltip(
        repayButton,
        canRegisterRepayment(liability)
            ? (liabilitiesMessages["liabilities.actions.registerRepayment"] ?? "")
            : (liabilitiesMessages["liabilities.actions.registerRepaymentDisabled"] ?? "")
    );
    repayButton.append(MoneySnapshotUi.createAddIcon());

    if (liability.liabilityTypeCode === "CREDIT_CARD") {
        const updateDebtButton = document.createElement("button");
        updateDebtButton.type = "button";
        updateDebtButton.className = "icon-button secondary";
        updateDebtButton.setAttribute("aria-label", liabilitiesMessages["liabilities.actions.updateCreditCardDebt"] ?? "");
        MoneySnapshotUi.setTooltip(updateDebtButton, liabilitiesMessages["liabilities.actions.updateCreditCardDebt"] ?? "");
        updateDebtButton.append(createSyncDebtIcon());
        updateDebtButton.addEventListener("click", () => {
            openCreditCardDebtModal(liability, updateDebtButton);
        });
        actions.append(editButton, repayButton, updateDebtButton);
    } else {
        actions.append(editButton, repayButton);
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button danger";
    deleteButton.setAttribute("aria-label", liabilitiesMessages["liabilities.actions.delete"] ?? "");
    MoneySnapshotUi.setTooltip(deleteButton, liabilitiesMessages["liabilities.actions.delete"] ?? "");
    deleteButton.append(MoneySnapshotUi.createTrashIcon());
    deleteButton.addEventListener("click", () => {
        deleteLiabilityModal.open(liability, liability.name);
    });

    actions.append(deleteButton);
    return actions;
}

function renderLiabilityGroup(liability, index) {
    const detailsId = `liability-details-${index + 1}`;
    const summaryRow = document.createElement("tr");
    summaryRow.className = "liability-summary-row";

    const nameCell = document.createElement("td");
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "liability-toggle";
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.setAttribute("aria-controls", detailsId);
    MoneySnapshotUi.setTooltip(toggleButton, liabilitiesMessages["liabilities.actions.toggleDetails"] ?? "");

    const chevron = document.createElement("span");
    chevron.className = "liability-toggle-chevron";
    chevron.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "liability-toggle-copy";

    const strong = document.createElement("strong");
    strong.textContent = liability.name;

    const meta = document.createElement("span");
    meta.className = "liability-row-meta";
    meta.textContent = liability.bankName;

    copy.append(strong, meta);
    toggleButton.append(chevron, copy);
    toggleButton.addEventListener("click", () => {
        const detailsRow = document.getElementById(detailsId);
        const expanded = toggleButton.getAttribute("aria-expanded") === "true";
        toggleButton.setAttribute("aria-expanded", String(!expanded));
        if (detailsRow) {
            detailsRow.hidden = expanded;
        }
    });
    nameCell.append(toggleButton);

    const originalAmountCell = document.createElement("td");
    originalAmountCell.className = "numeric-cell";
    originalAmountCell.textContent = formatMoney(liability.originalAmount);

    const repaymentAmountCell = document.createElement("td");
    repaymentAmountCell.className = "numeric-cell";
    repaymentAmountCell.textContent = formatMoney(liabilityRepaymentAmount(liability));

    const currentAmountCell = document.createElement("td");
    currentAmountCell.className = "numeric-cell";
    currentAmountCell.textContent = formatMoney(liability.currentAmount);

    const endDateCell = document.createElement("td");
    endDateCell.className = "numeric-cell";
    endDateCell.textContent = formatDate(liability.endDate);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `liability-status ${liabilityStatusClass(liability.status)}`;
    status.textContent = liabilityStatusLabel(liability.status);
    statusCell.append(status);

    const actionsCell = document.createElement("td");
    actionsCell.append(createActionButton(liability));

    summaryRow.append(nameCell, originalAmountCell, repaymentAmountCell, currentAmountCell, endDateCell, statusCell, actionsCell);

    const detailsRow = document.createElement("tr");
    detailsRow.className = "liability-details-row";
    detailsRow.id = detailsId;
    detailsRow.hidden = true;

    const detailsCell = document.createElement("td");
    detailsCell.colSpan = 7;

    const panel = document.createElement("div");
    panel.className = "liability-details-panel";

    const heading = document.createElement("h3");
    heading.textContent = liabilitiesMessages["liabilities.list.repayments"] ?? "";

    panel.append(heading, renderRepaymentList(liability.repayments));
    detailsCell.append(panel);
    detailsRow.append(detailsCell);

    return [summaryRow, detailsRow];
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = message;
    row.append(cell);
    liabilitiesTableBody.replaceChildren(row);
}

deleteLiabilityModal.confirmButton?.addEventListener("click", async () => {
    const selectedLiability = deleteLiabilityModal.getSelectedItem();
    if (!selectedLiability) {
        return;
    }

    deleteLiabilityModal.confirmButton.disabled = true;
    setListMessage("");

    try {
        const response = await fetch(`/api/liabilities/${encodeURIComponent(selectedLiability.id)}`, {
            method: "DELETE"
        });

        if (response.status === 404) {
            throw new Error(liabilitiesMessages["liabilities.error.notFound"] ?? "");
        }

        if (!response.ok) {
            throw new Error(liabilitiesMessages["liabilities.error.delete"] ?? "");
        }

        deleteLiabilityModal.close();
        showToast(liabilitiesMessages["liabilities.delete.success"] ?? "", "success");
        await loadDashboard();
    } catch (error) {
        deleteLiabilityModal.close();
        setListMessage(error.message, "error");
    } finally {
        deleteLiabilityModal.confirmButton.disabled = false;
    }
});

deleteLiabilityRepaymentModal.confirmButton?.addEventListener("click", async () => {
    const selectedRepayment = deleteLiabilityRepaymentModal.getSelectedItem();
    if (!selectedRepayment) {
        return;
    }

    deleteLiabilityRepaymentModal.confirmButton.disabled = true;
    setListMessage("");

    try {
        const response = await fetch(`/api/liabilities/repayments/${encodeURIComponent(selectedRepayment.id)}`, {
            method: "DELETE"
        });

        if (response.status === 404) {
            throw new Error(liabilitiesMessages["liabilities.repayments.error.notFound"] ?? "");
        }

        if (!response.ok) {
            throw new Error(liabilitiesMessages["liabilities.repayments.error.delete"] ?? "");
        }

        deleteLiabilityRepaymentModal.close();
        showToast(liabilitiesMessages["liabilities.repayments.delete.success"] ?? "", "success");
        await loadDashboard();
    } catch (error) {
        deleteLiabilityRepaymentModal.close();
        setListMessage(error.message, "error");
    } finally {
        deleteLiabilityRepaymentModal.confirmButton.disabled = false;
    }
});

creditCardDebtForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedCreditCardLiability) {
        return;
    }

    const rawAmount = normalizeDecimalInput(creditCardDebtInput?.value);
    if (rawAmount === null) {
        setCreditCardDebtMessage(liabilitiesMessages["liabilities.creditCardDebt.error.required"] ?? "", "error");
        return;
    }

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) {
        setCreditCardDebtMessage(liabilitiesMessages["liabilities.creditCardDebt.error.required"] ?? "", "error");
        return;
    }

    const limit = Number(selectedCreditCardLiability.creditCardLimit ?? 0);
    if (Number.isFinite(limit) && amount > limit) {
        setCreditCardDebtMessage(liabilitiesMessages["liabilities.creditCardDebt.error.exceedsLimit"] ?? "", "error");
        return;
    }

    creditCardDebtSubmitButton.disabled = true;
    setCreditCardDebtMessage("");

    try {
        const response = await fetch(`/api/liabilities/${encodeURIComponent(selectedCreditCardLiability.id)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(liabilityUpdatePayload(selectedCreditCardLiability, {currentAmount: rawAmount}))
        });

        if (response.status === 404) {
            throw new Error(liabilitiesMessages["liabilities.error.notFound"] ?? "");
        }

        if (response.status === 400) {
            throw new Error(liabilitiesMessages["liabilities.creditCardDebt.error.update"] ?? "");
        }

        if (!response.ok) {
            throw new Error(liabilitiesMessages["liabilities.creditCardDebt.error.update"] ?? "");
        }

        creditCardDebtModal.close();
        selectedCreditCardLiability = null;
        showToast(liabilitiesMessages["liabilities.creditCardDebt.success"] ?? "", "success");
        await loadDashboard();
    } catch (error) {
        setCreditCardDebtMessage(error.message, "error");
    } finally {
        creditCardDebtSubmitButton.disabled = false;
    }
});

function renderDashboard(dashboard) {
    cachedDashboard = dashboard;
    dashboardLoaded = true;
    renderSummary(dashboard.summary);

    if (!dashboard.liabilities || dashboard.liabilities.length === 0) {
        renderEmpty(liabilitiesMessages["liabilities.empty"] ?? "");
        return;
    }

    liabilitiesTableBody.replaceChildren(...dashboard.liabilities.flatMap(renderLiabilityGroup));
}

async function loadDashboard() {
    if (liabilitiesListMessage) {
        setListMessage("");
    }

    const response = await fetch("/api/liabilities");
    if (!response.ok) {
        throw new Error(liabilitiesMessages["liabilities.error.load"] ?? "Cannot load liabilities.");
    }

    renderDashboard(await response.json());
}

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    liabilitiesMessages = nextMessages;
    document.title = `${liabilitiesMessages["liabilities.heading.title"]} | ${liabilitiesMessages["app.name"]}`;
    if (newLiabilityAction) {
        MoneySnapshotUi.setTooltip(newLiabilityAction, liabilitiesMessages["liabilities.actions.registerLiability"]);
    }
    if (newLiabilityRepaymentAction) {
        MoneySnapshotUi.setTooltip(newLiabilityRepaymentAction, liabilitiesMessages["liabilities.actions.registerRepayment"]);
    }
    if (creditCardDebtModalElement) {
        const updateButtons = creditCardDebtModalElement.querySelectorAll("[data-credit-card-debt-modal-close]");
        updateButtons.forEach((button) => MoneySnapshotUi.setTooltip(button, liabilitiesMessages["common.close"]));
    }

    if (dashboardLoaded && cachedDashboard) {
        renderDashboard(cachedDashboard);
    }
}

MoneySnapshotI18n.init({
    endpoint: "/api/liabilities/messages",
    onLanguageChange: ({language, messages}) => {
        handleLanguageChange(language, messages);
    }
})
    .then(() => MoneySnapshotUi.loadUserSettings())
    .then((settings) => {
        userSettings = settings;
    })
    .then(loadDashboard)
    .then(showPendingNotification)
    .catch((error) => {
        renderSummary(null);
        renderEmpty(error.message);
        setListMessage(error.message, "error");
    });
