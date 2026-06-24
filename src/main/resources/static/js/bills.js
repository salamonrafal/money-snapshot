const billsTableBody = document.querySelector("#bills-table-body");
const billsSummaryActiveCount = document.querySelector("#bills-summary-active-count");
const billsSummaryMonthlyAmount = document.querySelector("#bills-summary-monthly-amount");
const billsSummaryNextDue = document.querySelector("#bills-summary-next-due");
const billsSummaryOpenEndedCount = document.querySelector("#bills-summary-open-ended-count");
const openBillFormModalButton = document.querySelector("#open-bill-form-modal");
const billForm = document.querySelector("#bill-form");
const billFormMessageContainer = document.querySelector("#bill-form-message-container");
const billFormMessage = document.querySelector("#bill-form-message");
const billDurationTypeField = document.querySelector("#bill-duration-type");
const billEndDateField = document.querySelector("#bill-end-date-field");
const billInstallmentsField = document.querySelector("#bill-installments-field");
const billCounterpartySelect = document.querySelector("#bill-counterparty");
const billAccountSelect = document.querySelector("#bill-account");
const billFormModalTitle = document.querySelector("#bill-form-modal-title");
const billInfoTitle = document.querySelector("#bill-info-title");
const billInfoList = document.querySelector("#bill-info-list");
const deleteBillModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-bill-modal",
    subjectSelector: "#delete-bill-name",
    confirmSelector: "#confirm-delete-bill",
    cancelSelector: "#cancel-delete-bill"
});
const scheduleOverwriteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#bill-schedule-overwrite-modal",
    subjectSelector: "#bill-schedule-overwrite-name",
    confirmSelector: "#confirm-bill-schedule-overwrite",
    cancelSelector: "#cancel-bill-schedule-overwrite"
});
const scheduleOverwriteCancelButton = document.querySelector("#cancel-bill-schedule-overwrite");
const billInfoModal = MoneySnapshotUi.createModal({
    modalSelector: "#bill-info-modal",
    closeSelectors: ["#bill-info-close"]
});
const billFormModal = MoneySnapshotUi.createModal({
    modalSelector: "#bill-form-modal",
    closeSelectors: ["#bill-form-modal [data-bill-form-modal-close]"]
});

let billsData = [];
let billsMessages = {};
let billsUserSettings = null;
let availableAccounts = [];
let availableCounterparties = [];
let selectedEditBillId = null;
let selectedBillForDetails = null;
let selectedEditBillSnapshot = null;
let pendingBillSubmitPayload = null;

function resetBillFieldState() {
    if (!billForm) {
        return;
    }

    billForm.querySelectorAll("[aria-invalid='true']").forEach((field) => {
        field.removeAttribute("aria-invalid");
    });
}

function hideBillFormMessage() {
    if (billFormMessageContainer) {
        billFormMessageContainer.hidden = true;
    }
    if (billFormMessage) {
        billFormMessage.textContent = "";
    }
}

function showBillFormMessage(message) {
    if (billFormMessage) {
        billFormMessage.textContent = message;
    }
    if (billFormMessageContainer) {
        billFormMessageContainer.hidden = false;
    }
}

function handleBillsLanguageChange(nextMessages) {
    billsMessages = nextMessages;
    document.title = `${billsMessages["bills.heading.title"]} | ${billsMessages["app.name"]}`;
    if (billInfoModal.isOpen()) {
        renderBillInfoModal();
    }
    renderBillReferenceOptions();
    renderBillsPage();
    syncBillDurationFields();
}

function formatBillMoney(value) {
    return MoneySnapshotUi.formatMoneyValue(value, billsUserSettings);
}

function formatBillDate(value) {
    return value ? MoneySnapshotUi.formatDateValue(value, billsUserSettings) : "-";
}

function formatBillDateTime(value) {
    return value ? MoneySnapshotUi.formatDateTimeValue(value, billsUserSettings) : "-";
}

function formatBillDuration(bill) {
    if (bill.durationType === "UNTIL_DATE" && bill.endDate) {
        return (billsMessages["bills.duration.untilDate"] ?? "").replace("{date}", formatBillDate(bill.endDate));
    }

    if (bill.durationType === "INSTALLMENTS" && bill.installmentCount) {
        return (billsMessages["bills.duration.installments"] ?? "").replace("{count}", String(bill.installmentCount));
    }

    return billsMessages["bills.duration.openEnded"] ?? "";
}

function formatBillRepaymentDay(value) {
    return value == null ? "-" : String(value);
}

function billDetailsValue(value) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || (billsMessages["bills.info.notAvailable"] ?? "-");
    }

    return value == null ? (billsMessages["bills.info.notAvailable"] ?? "-") : String(value);
}

function syncBillDurationFields() {
    if (!billDurationTypeField || !billEndDateField || !billInstallmentsField) {
        return;
    }

    const durationType = billDurationTypeField.value;
    const endDateInput = billEndDateField.querySelector("input");
    const installmentsInput = billInstallmentsField.querySelector("input");
    const showEndDate = durationType === "UNTIL_DATE";
    const showInstallments = durationType === "INSTALLMENTS";

    billEndDateField.hidden = !showEndDate;
    billInstallmentsField.hidden = !showInstallments;

    if (endDateInput) {
        endDateInput.disabled = !showEndDate;
        endDateInput.required = showEndDate;
        if (!showEndDate) {
            endDateInput.value = "";
            endDateInput.removeAttribute("aria-invalid");
        }
    }

    if (installmentsInput) {
        installmentsInput.disabled = !showInstallments;
        installmentsInput.required = showInstallments;
        if (!showInstallments) {
            installmentsInput.value = "";
            installmentsInput.removeAttribute("aria-invalid");
        }
    }
}

function createBillStatusBadge(status) {
    const badge = document.createElement("span");
    badge.className = "liability-status";
    badge.textContent = billsMessages[`bills.status.${status}`] ?? status;

    if (status === "ACTIVE") {
        badge.classList.add("liability-status-active");
    } else if (status === "SUSPENDED") {
        badge.classList.add("liability-status-suspended");
    } else {
        badge.classList.add("liability-status-completed");
    }

    return badge;
}

function sortBills(items) {
    return [...items].sort((left, right) => {
        if (left.repaymentDay !== right.repaymentDay) {
            return left.repaymentDay - right.repaymentDay;
        }
        return `${left.name ?? ""}`.localeCompare(`${right.name ?? ""}`, undefined, {sensitivity: "base"});
    });
}

function parseIsoDate(value) {
    if (!value || typeof value !== "string") {
        return null;
    }

    const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
    if (!year || !month || !day) {
        return null;
    }

    return new Date(year, month - 1, day);
}

function isoDateFromLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function billDueDateForMonth(startDate, monthOffset, repaymentDay) {
    const candidate = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, 1);
    const lastDayOfMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    candidate.setDate(Math.min(repaymentDay, lastDayOfMonth));
    return candidate;
}

function monthDifference(startDate, endDate) {
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

function resolveNextBillDueDate(bill, today = new Date()) {
    const startDate = parseIsoDate(bill.startFrom);
    if (!startDate || !Number.isInteger(bill.repaymentDay)) {
        return null;
    }

    const referenceDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = parseIsoDate(bill.endDate);
    const startingMonthOffset = Math.max(monthDifference(startDate, referenceDate), 0);
    if (bill.durationType === "INSTALLMENTS") {
        const installmentCount = Math.max(bill.installmentCount ?? 0, 0);
        let validInstallments = 0;

        for (let monthOffset = 0; validInstallments < installmentCount; monthOffset += 1) {
            const dueDate = billDueDateForMonth(startDate, monthOffset, bill.repaymentDay);
            if (dueDate < startDate) {
                continue;
            }

            validInstallments += 1;
            if (dueDate >= referenceDate) {
                return isoDateFromLocalDate(dueDate);
            }
        }

        return null;
    }

    for (let monthOffset = startingMonthOffset; ; monthOffset += 1) {
        const dueDate = billDueDateForMonth(startDate, monthOffset, bill.repaymentDay);
        if (dueDate < startDate) {
            continue;
        }
        if (endDate && dueDate > endDate) {
            return null;
        }
        if (dueDate >= referenceDate) {
            return isoDateFromLocalDate(dueDate);
        }
    }
}

function renderBillsTable() {
    if (!billsTableBody) {
        return;
    }

    if (billsData.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 6;
        cell.textContent = billsMessages["bills.table.empty"] ?? "";
        row.append(cell);
        billsTableBody.replaceChildren(row);
        return;
    }

    billsTableBody.replaceChildren(...billsData.map((bill) => {
        const row = document.createElement("tr");

        [
            bill.name ?? "-",
            formatBillMoney(bill.amount),
            formatBillDate(bill.startFrom),
            bill.counterpartyName ?? "-"
        ].forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (index === 1) {
                cell.className = "bills-amount-cell";
            }
            row.append(cell);
        });

        const statusCell = document.createElement("td");
        statusCell.append(createBillStatusBadge(bill.status));
        row.append(statusCell);

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        actions.className = "row-actions";
        actions.append(
            createBillInfoAction(bill),
            createBillScheduleAction(bill),
            createBillEditAction(bill),
            createBillDeleteAction(bill)
        );
        actionsCell.append(actions);
        row.append(actionsCell);

        return row;
    }));
}

function buildBillInfoFields(bill) {
    return [
        {label: billsMessages["bills.table.name"] ?? "", value: billDetailsValue(bill.name)},
        {label: billsMessages["bills.table.amount"] ?? "", value: formatBillMoney(bill.amount)},
        {label: billsMessages["bills.table.duration"] ?? "", value: formatBillDuration(bill)},
        {label: billsMessages["bills.table.repaymentDay"] ?? "", value: formatBillRepaymentDay(bill.repaymentDay)},
        {label: billsMessages["bills.table.startFrom"] ?? "", value: formatBillDate(bill.startFrom)},
        {label: billsMessages["bills.table.counterparty"] ?? "", value: billDetailsValue(bill.counterpartyName)},
        {label: billsMessages["bills.table.fromAccount"] ?? "", value: billDetailsValue(bill.accountName)},
        {label: billsMessages["bills.table.status"] ?? "", value: billsMessages[`bills.status.${bill.status}`] ?? bill.status},
        {label: billsMessages["bills.info.createdAt"] ?? "", value: formatBillDateTime(bill.createdAt)},
        {label: billsMessages["bills.info.updatedAt"] ?? "", value: formatBillDateTime(bill.updatedAt)}
    ];
}

function renderBillInfoModal() {
    if (!selectedBillForDetails || !billInfoTitle || !billInfoList) {
        return;
    }

    billInfoTitle.textContent = billsMessages["bills.info.title"] ?? "";
    billInfoList.replaceChildren(...buildBillInfoFields(selectedBillForDetails).flatMap(({label, value}) => {
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.textContent = label;
        detail.textContent = value;
        return [term, detail];
    }));
}

function openBillInfoModal(bill, trigger) {
    selectedBillForDetails = bill;
    renderBillInfoModal();
    billInfoModal.open({trigger});
}

function renderBillsSummary() {
    const activeBills = billsData.filter((bill) => bill.status === "ACTIVE");
    const openEndedCount = billsData.filter((bill) => bill.durationType === "OPEN_ENDED").length;
    const nextDueDate = activeBills
        .map((bill) => resolveNextBillDueDate(bill))
        .filter(Boolean)
        .sort()[0] ?? null;
    const activeAmount = activeBills.reduce((total, bill) => total + Number(bill.amount ?? 0), 0);

    if (billsSummaryActiveCount) {
        billsSummaryActiveCount.textContent = String(activeBills.length);
    }
    if (billsSummaryMonthlyAmount) {
        billsSummaryMonthlyAmount.textContent = formatBillMoney(activeAmount);
    }
    if (billsSummaryOpenEndedCount) {
        billsSummaryOpenEndedCount.textContent = String(openEndedCount);
    }
    if (billsSummaryNextDue) {
        billsSummaryNextDue.textContent = nextDueDate ? formatBillDate(nextDueDate) : "-";
    }
}

function renderBillsPage() {
    if (!billsMessages || Object.keys(billsMessages).length === 0) {
        return;
    }

    renderBillsSummary();
    renderBillsTable();
}

function formatBillAccountOption(account) {
    const bankName = (account.bankName ?? "").trim();
    const accountName = (account.accountName ?? "").trim();

    if (bankName && accountName) {
        return `[${bankName}] ${accountName}`;
    }

    return accountName || bankName || "";
}

function replaceSelectOptions(select, items, labelSelector, selectedValue = "") {
    if (!select) {
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "";

    const options = items.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = labelSelector(item);
        return option;
    });

    select.replaceChildren(placeholder, ...options);
    select.value = selectedValue;
}

function renderBillReferenceOptions() {
    replaceSelectOptions(
        billCounterpartySelect,
        availableCounterparties,
        (item) => item.name ?? "",
        billCounterpartySelect?.value ?? ""
    );
    replaceSelectOptions(
        billAccountSelect,
        availableAccounts,
        (item) => formatBillAccountOption(item),
        billAccountSelect?.value ?? ""
    );
}

function setBillModalMode(isEdit) {
    if (!billFormModalTitle) {
        return;
    }

    billFormModalTitle.textContent = isEdit
        ? (billsMessages["bills.actions.edit"] ?? billsMessages["bills.form.title"] ?? "")
        : (billsMessages["bills.form.title"] ?? "");
}

function resetBillForm() {
    if (!billForm) {
        return;
    }

    selectedEditBillId = null;
    selectedEditBillSnapshot = null;
    pendingBillSubmitPayload = null;
    billForm.reset();
    renderBillReferenceOptions();
    setBillModalMode(false);
    hideBillFormMessage();
    resetBillFieldState();
    syncBillDurationFields();
}

function normalizeBillAmount(value) {
    return typeof value === "string" ? value.replace(/\s+/g, "").replace(",", ".") : "";
}

function buildBillValidationErrors(formData) {
    const errors = [];
    const requiredFields = [
        ["name", "bills.form.name"],
        ["amount", "bills.form.amount"],
        ["repaymentDay", "bills.form.repaymentDay"],
        ["startFrom", "bills.form.startFrom"],
        ["counterpartyId", "bills.form.counterparty"],
        ["accountId", "bills.form.fromAccount"]
    ];

    requiredFields.forEach(([fieldName, messageKey]) => {
        const value = (formData.get(fieldName) ?? "").toString().trim();
        if (!value) {
            errors.push({fieldName, label: billsMessages[messageKey] ?? fieldName});
        }
    });

    const durationType = (formData.get("durationType") ?? "").toString();
    if (durationType === "UNTIL_DATE" && !(formData.get("endDate") ?? "").toString().trim()) {
        errors.push({fieldName: "endDate", label: billsMessages["bills.form.endDate"] ?? "endDate"});
    }
    if (durationType === "UNTIL_DATE" && billDatesAreInInvalidOrder(formData.get("startFrom"), formData.get("endDate"))) {
        errors.push({
            fieldName: "endDate",
            label: billsMessages["bills.form.error.endDateBeforeStartDate"] ?? "endDate"
        });
    }
    if (durationType === "INSTALLMENTS" && !(formData.get("installments") ?? "").toString().trim()) {
        errors.push({fieldName: "installments", label: billsMessages["bills.form.installments"] ?? "installments"});
    }

    const amount = Number.parseFloat(normalizeBillAmount((formData.get("amount") ?? "").toString()));
    if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({fieldName: "amount", label: billsMessages["bills.form.amount"] ?? "amount"});
    }

    const repaymentDay = Number.parseInt((formData.get("repaymentDay") ?? "").toString(), 10);
    if (!Number.isInteger(repaymentDay) || repaymentDay < 1 || repaymentDay > 31) {
        errors.push({fieldName: "repaymentDay", label: billsMessages["bills.form.repaymentDay"] ?? "repaymentDay"});
    }

    if (durationType === "INSTALLMENTS") {
        const installmentsValue = Number.parseInt((formData.get("installments") ?? "").toString(), 10);
        if (!Number.isInteger(installmentsValue) || installmentsValue < 1) {
            errors.push({fieldName: "installments", label: billsMessages["bills.form.installments"] ?? "installments"});
        }
    }

    return errors;
}

function renderBillValidationErrors(errors) {
    resetBillFieldState();

    if (!errors.length) {
        hideBillFormMessage();
        return;
    }

    const uniqueErrors = Array.from(new Map(errors.map((error) => [error.fieldName, error])).values());
    uniqueErrors.forEach(({fieldName}) => {
        const field = billForm?.elements.namedItem(fieldName);
        if (field instanceof HTMLElement) {
            field.setAttribute("aria-invalid", "true");
        }
    });

    const message = (billsMessages["bills.form.error.required"] ?? "").replace(
        "{fields}",
        uniqueErrors.map(({label}) => label).join(", ")
    );
    showBillFormMessage(message);
}

function buildBillPayload(formData) {
    return {
        name: (formData.get("name") ?? "").toString().trim(),
        amount: Number.parseFloat(normalizeBillAmount((formData.get("amount") ?? "").toString())),
        durationType: (formData.get("durationType") ?? "UNTIL_DATE").toString(),
        endDate: ((formData.get("endDate") ?? "").toString().trim()) || null,
        installmentCount: (() => {
            const value = Number.parseInt((formData.get("installments") ?? "").toString(), 10);
            return Number.isInteger(value) ? value : null;
        })(),
        repaymentDay: Number.parseInt((formData.get("repaymentDay") ?? "").toString(), 10),
        startFrom: (formData.get("startFrom") ?? "").toString(),
        counterpartyId: (formData.get("counterpartyId") ?? "").toString(),
        accountId: (formData.get("accountId") ?? "").toString(),
        status: (formData.get("status") ?? "ACTIVE").toString()
    };
}

function normalizeBillDateField(value) {
    const normalizedValue = (value ?? "").toString().trim();
    return normalizedValue || null;
}

function billDatesAreInInvalidOrder(startFrom, endDate) {
    const normalizedStartFrom = normalizeBillDateField(startFrom);
    const normalizedEndDate = normalizeBillDateField(endDate);
    return Boolean(normalizedStartFrom && normalizedEndDate && normalizedEndDate < normalizedStartFrom);
}

function normalizeBillIntegerField(value) {
    const numericValue = Number.parseInt((value ?? "").toString(), 10);
    return Number.isInteger(numericValue) ? numericValue : null;
}

function findAvailableAccountById(accountId) {
    const normalizedAccountId = (accountId ?? "").toString().trim();
    if (!normalizedAccountId) {
        return null;
    }

    return availableAccounts.find((account) => (account?.id ?? "").toString() === normalizedAccountId) ?? null;
}

function billScheduleOverwriteRequired(payload, originalBill) {
    if (!payload || !originalBill) {
        return false;
    }

    const normalizedOriginalEndDate = normalizeBillDateField(originalBill.endDate);
    const normalizedOriginalInstallmentCount = normalizeBillIntegerField(originalBill.installmentCount);
    const normalizedOriginalAccountId = (originalBill.accountId ?? "").toString().trim();
    const normalizedNextAccountId = (payload.accountId ?? "").toString().trim();
    const selectedAccount = findAvailableAccountById(normalizedNextAccountId);
    const accountCurrencyChanged = normalizedNextAccountId !== normalizedOriginalAccountId
        && Boolean(selectedAccount?.currencyCode)
        && (selectedAccount.currencyCode ?? "") !== (originalBill.currencyCode ?? "");

    return payload.durationType !== (originalBill.durationType ?? null)
        || normalizeBillDateField(payload.endDate) !== normalizedOriginalEndDate
        || normalizeBillIntegerField(payload.installmentCount) !== normalizedOriginalInstallmentCount
        || normalizeBillIntegerField(payload.repaymentDay) !== normalizeBillIntegerField(originalBill.repaymentDay)
        || normalizeBillDateField(payload.startFrom) !== normalizeBillDateField(originalBill.startFrom)
        || Number(payload.amount) !== Number(originalBill.amount)
        || accountCurrencyChanged;
}

async function submitBillPayload(payload) {
    const savedBill = await saveBill(payload);
    billsData = sortBills([savedBill, ...billsData.filter((bill) => bill.id !== savedBill.id)]);
    renderBillsPage();
    billFormModal.close();
    resetBillForm();
}

async function readErrorPayload(response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
        return null;
    }

    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function loadBills() {
    const response = await fetch("/api/bills");
    if (!response.ok) {
        throw new Error("Cannot load bills.");
    }

    billsData = sortBills(await response.json());
}

async function loadBillReferenceData() {
    const [accountsResponse, counterpartiesResponse] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/counterparties")
    ]);

    if (!accountsResponse.ok || !counterpartiesResponse.ok) {
        throw new Error("Cannot load bill reference data.");
    }

    availableAccounts = await accountsResponse.json();
    availableCounterparties = await counterpartiesResponse.json();
    renderBillReferenceOptions();
}

async function saveBill(payload) {
    const response = await fetch(
        selectedEditBillId ? `/api/bills/${encodeURIComponent(selectedEditBillId)}` : "/api/bills",
        {
        method: selectedEditBillId ? "PUT" : "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 400 && errorPayload?.fieldErrors) {
        const validationError = new Error(errorPayload.message ?? "Validation failed.");
        validationError.fieldErrors = errorPayload.fieldErrors;
        throw validationError;
    }

    if (response.status === 400 && errorPayload?.message === "End date must be on or after start date.") {
        throw new Error(billsMessages["bills.form.error.endDateBeforeStartDate"] ?? errorPayload.message);
    }

    if (response.status === 409) {
        const duplicateError = new Error(
            billsMessages["bills.form.error.duplicate"]
            ?? errorPayload?.message
            ?? "Bill with the same name already exists."
        );
        duplicateError.fieldErrors = {name: true};
        throw duplicateError;
    }

    if (!response.ok) {
        throw new Error(errorPayload?.message ?? "Request failed.");
    }

    return response.json();
}

function fillBillForm(bill) {
    if (!billForm) {
        return;
    }

    const elements = billForm.elements;
    elements.namedItem("name").value = bill.name ?? "";
    elements.namedItem("amount").value = bill.amount ?? "";
    elements.namedItem("durationType").value = bill.durationType ?? "UNTIL_DATE";
    elements.namedItem("endDate").value = bill.endDate ?? "";
    elements.namedItem("installments").value = bill.installmentCount ?? "";
    elements.namedItem("repaymentDay").value = bill.repaymentDay ?? "";
    elements.namedItem("startFrom").value = bill.startFrom ?? "";
    elements.namedItem("counterpartyId").value = bill.counterpartyId ?? "";
    elements.namedItem("accountId").value = bill.accountId ?? "";
    elements.namedItem("status").value = bill.status ?? "ACTIVE";
    syncBillDurationFields();
}

function createBillEditAction(bill) {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-button";
    editButton.setAttribute("aria-label", billsMessages["bills.actions.edit"] ?? "");
    MoneySnapshotUi.setTooltip(editButton, billsMessages["bills.actions.edit"] ?? "");
    editButton.append(MoneySnapshotUi.createEditIcon());
    editButton.addEventListener("click", () => {
        resetBillFieldState();
        hideBillFormMessage();
        renderBillReferenceOptions();
        selectedEditBillId = bill.id;
        selectedEditBillSnapshot = typeof structuredClone === "function"
            ? structuredClone(bill)
            : JSON.parse(JSON.stringify(bill));
        fillBillForm(bill);
        setBillModalMode(true);
        billFormModal.open({trigger: editButton});
    });
    return editButton;
}

function createBillInfoAction(bill) {
    const infoButton = document.createElement("button");
    infoButton.type = "button";
    infoButton.className = "icon-button";
    infoButton.setAttribute("aria-label", billsMessages["bills.actions.info"] ?? "");
    MoneySnapshotUi.setTooltip(infoButton, billsMessages["bills.actions.info"] ?? "");
    infoButton.append(MoneySnapshotUi.createInfoIcon());
    infoButton.addEventListener("click", () => {
        openBillInfoModal(bill, infoButton);
    });
    return infoButton;
}

function createBillDeleteAction(bill) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button danger";
    deleteButton.setAttribute("aria-label", billsMessages["bills.actions.delete"] ?? "");
    MoneySnapshotUi.setTooltip(deleteButton, billsMessages["bills.actions.delete"] ?? "");
    deleteButton.append(MoneySnapshotUi.createTrashIcon());
    deleteButton.addEventListener("click", () => {
        deleteBillModal.open(bill, bill.name ?? "");
    });
    return deleteButton;
}

function createBillScheduleAction(bill) {
    const scheduleLink = document.createElement("a");
    scheduleLink.className = "icon-button";
    scheduleLink.href = `/bills/${encodeURIComponent(bill.id)}/schedule.html`;
    scheduleLink.setAttribute("aria-label", billsMessages["bills.actions.schedule"] ?? "");
    MoneySnapshotUi.setTooltip(scheduleLink, billsMessages["bills.actions.schedule"] ?? "");
    scheduleLink.append(MoneySnapshotUi.createCalendarIcon());
    return scheduleLink;
}

async function handleBillFormSubmit(event) {
    event.preventDefault();

    if (!billForm) {
        return;
    }

    const formData = new FormData(billForm);
    const errors = buildBillValidationErrors(formData);
    if (errors.length > 0) {
        renderBillValidationErrors(errors);
        return;
    }

    hideBillFormMessage();
    resetBillFieldState();

    try {
        const payload = buildBillPayload(formData);
        if (selectedEditBillId && billScheduleOverwriteRequired(payload, selectedEditBillSnapshot)) {
            pendingBillSubmitPayload = payload;
            billFormModal.close();
            scheduleOverwriteModal.open(
                {id: selectedEditBillId},
                selectedEditBillSnapshot?.name ?? payload.name ?? ""
            );
            return;
        }
        await submitBillPayload(payload);
    } catch (error) {
        if (error.fieldErrors) {
            renderBillValidationErrors(Object.keys(error.fieldErrors).map((fieldName) => ({
                fieldName,
                label: ({
                    name: billsMessages["bills.form.name"],
                    amount: billsMessages["bills.form.amount"],
                    repaymentDay: billsMessages["bills.form.repaymentDay"],
                    startFrom: billsMessages["bills.form.startFrom"],
                    endDate: billsMessages["bills.form.endDate"],
                    installmentCount: billsMessages["bills.form.installments"],
                    installments: billsMessages["bills.form.installments"],
                    counterpartyId: billsMessages["bills.form.counterparty"],
                    accountId: billsMessages["bills.form.fromAccount"]
                })[fieldName] ?? fieldName
            })));
        }
        showBillFormMessage(error.message ?? "Request failed.");
    }
}

async function deleteBill(id) {
    const response = await fetch(`/api/bills/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (!response.ok) {
        throw new Error(errorPayload?.message ?? billsMessages["bills.error.delete"] ?? "Request failed.");
    }
}

if (openBillFormModalButton) {
    openBillFormModalButton.addEventListener("click", (event) => {
        event.preventDefault();
        resetBillForm();
        billFormModal.open({trigger: openBillFormModalButton});
    });
}

if (billDurationTypeField) {
    billDurationTypeField.addEventListener("change", () => {
        syncBillDurationFields();
        hideBillFormMessage();
    });
}

if (billForm) {
    billForm.addEventListener("submit", handleBillFormSubmit);
    billForm.addEventListener("input", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement) {
            target.removeAttribute("aria-invalid");
        }
        if (billFormMessageContainer && !billFormMessageContainer.hidden) {
            hideBillFormMessage();
        }
    });
    billForm.addEventListener("change", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement) {
            target.removeAttribute("aria-invalid");
        }
    });
}

deleteBillModal.confirmButton?.addEventListener("click", async () => {
    const selectedBill = deleteBillModal.getSelectedItem();
    if (!selectedBill) {
        return;
    }

    deleteBillModal.confirmButton.disabled = true;

    try {
        await deleteBill(selectedBill.id);
        billsData = billsData.filter((bill) => bill.id !== selectedBill.id);
        deleteBillModal.close();
        renderBillsPage();
    } catch (error) {
        deleteBillModal.close();
        showBillFormMessage(error.message ?? billsMessages["bills.error.delete"] ?? "Request failed.");
    } finally {
        deleteBillModal.confirmButton.disabled = false;
    }
});

scheduleOverwriteModal.confirmButton?.addEventListener("click", async () => {
    if (!pendingBillSubmitPayload) {
        scheduleOverwriteModal.close();
        return;
    }

    scheduleOverwriteModal.confirmButton.disabled = true;

    try {
        await submitBillPayload(pendingBillSubmitPayload);
        scheduleOverwriteModal.close();
    } catch (error) {
        if (error.fieldErrors) {
            renderBillValidationErrors(Object.keys(error.fieldErrors).map((fieldName) => ({
                fieldName,
                label: ({
                    name: billsMessages["bills.form.name"],
                    amount: billsMessages["bills.form.amount"],
                    repaymentDay: billsMessages["bills.form.repaymentDay"],
                    startFrom: billsMessages["bills.form.startFrom"],
                    endDate: billsMessages["bills.form.endDate"],
                    installmentCount: billsMessages["bills.form.installments"],
                    installments: billsMessages["bills.form.installments"],
                    counterpartyId: billsMessages["bills.form.counterparty"],
                    accountId: billsMessages["bills.form.fromAccount"]
                })[fieldName] ?? fieldName
            })));
        }
        billFormModal.open();
        showBillFormMessage(error.message ?? "Request failed.");
    } finally {
        pendingBillSubmitPayload = null;
        scheduleOverwriteModal.confirmButton.disabled = false;
    }
});

scheduleOverwriteCancelButton?.addEventListener("click", () => {
    pendingBillSubmitPayload = null;
    if (selectedEditBillId) {
        billFormModal.open();
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/bills/messages",
    onLanguageChange: ({messages}) => {
        handleBillsLanguageChange(messages);
    }
})
    .then(() => Promise.all([
        MoneySnapshotUi.loadUserSettings(),
        loadBills()
    ]))
    .then(([settings]) => {
        billsUserSettings = settings;
        renderBillsPage();
        return loadBillReferenceData().catch((error) => {
            console.error(error);
        });
    })
    .catch((error) => {
        console.error(error);
    });
