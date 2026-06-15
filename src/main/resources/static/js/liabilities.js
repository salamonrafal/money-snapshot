const liabilitiesTableBody = document.querySelector("#liabilities-table-body");
const liabilitiesSummaryActiveCount = document.querySelector("#liabilities-summary-active-count");
const liabilitiesSummaryMonthlyDue = document.querySelector("#liabilities-summary-monthly-due");
const liabilitiesSummaryCurrentDebt = document.querySelector("#liabilities-summary-current-debt");
const liabilitiesSummaryNextPayment = document.querySelector("#liabilities-summary-next-payment");
const liabilitiesListMessage = document.querySelector("#liabilities-list-message");
const newLiabilityAction = document.getElementById("new-liability-action");
const newLiabilityRepaymentAction = document.getElementById("new-liability-repayment-action");
const newLiabilityModalElement = document.querySelector("#new-liability-modal");
const newLiabilityModal = MoneySnapshotUi.createModal({
    modalSelector: "#new-liability-modal",
    closeSelectors: ["#new-liability-modal [data-new-liability-modal-close]"]
});
const newLiabilityForm = document.getElementById("new-liability-form");
const newLiabilityFormMessageContainer = document.getElementById("new-liability-form-message-container");
const newLiabilityFormMessage = document.getElementById("new-liability-form-message");
const newLiabilitySubmitButton = document.getElementById("new-liability-submit");
const newLiabilityBankSelect = document.getElementById("new-liability-bank");
const newLiabilityNameInput = document.getElementById("new-liability-name");
const newLiabilityTypeSelect = document.getElementById("new-liability-type");
const newLiabilityCurrentAmountField = document.getElementById("new-liability-current-amount-field");
const newLiabilityInstallmentAmountField = document.getElementById("new-liability-installment-amount-field");
const newLiabilityCreditLimitField = document.getElementById("new-liability-credit-limit-field");
const newLiabilityCreditCardCurrentAmountField = document.getElementById("new-liability-credit-card-current-amount-field");
const newLiabilityCreditCardMinimumPaymentField = document.getElementById("new-liability-credit-card-minimum-payment-field");
const newLiabilityCurrentAmountInput = document.getElementById("new-liability-current-amount");
const newLiabilityInstallmentAmountInput = document.getElementById("new-liability-installment-amount");
const newLiabilityCreditLimitInput = document.getElementById("new-liability-credit-limit");
const newLiabilityCreditCardCurrentAmountInput = document.getElementById("new-liability-credit-card-current-amount");
const newLiabilityCreditCardMinimumPaymentInput = document.getElementById("new-liability-credit-card-minimum-payment");
const newLiabilityRepaymentStartDateInput = document.getElementById("new-liability-repayment-start-date");
const newLiabilityEndDateInput = document.getElementById("new-liability-end-date");
const newLiabilityInstallmentCountField = document.getElementById("new-liability-installment-count-field");
const newLiabilityInstallmentCountInput = document.getElementById("new-liability-installment-count");
const newLiabilityFirstRepaymentDayField = document.getElementById("new-liability-first-repayment-day-field");
const newLiabilityFirstRepaymentDayInput = document.getElementById("new-liability-first-repayment-day");
const newLiabilityScheduleModeField = document.getElementById("new-liability-schedule-mode-field");
const newLiabilityScheduleModeSelect = document.getElementById("new-liability-schedule-mode");
const newLiabilityEndDateField = document.getElementById("new-liability-end-date-field");
const newLiabilityStatusSelect = document.getElementById("new-liability-status");
const newLiabilityNoteInput = document.getElementById("new-liability-note");
const editLiabilityModalElement = document.querySelector("#edit-liability-modal");
const editLiabilityModal = MoneySnapshotUi.createModal({
    modalSelector: "#edit-liability-modal",
    closeSelectors: ["#edit-liability-modal [data-edit-liability-modal-close]"]
});
const editLiabilityForm = document.getElementById("edit-liability-form");
const editLiabilityFormMessageContainer = document.getElementById("edit-liability-form-message-container");
const editLiabilityFormMessage = document.getElementById("edit-liability-form-message");
const editLiabilitySubmitButton = document.getElementById("edit-liability-submit");
const editLiabilityBankSelect = document.getElementById("edit-liability-bank");
const editLiabilityNameInput = document.getElementById("edit-liability-name");
const editLiabilityTypeSelect = document.getElementById("edit-liability-type");
const editLiabilityCurrentAmountField = document.getElementById("edit-liability-current-amount-field");
const editLiabilityInstallmentAmountField = document.getElementById("edit-liability-installment-amount-field");
const editLiabilityCreditLimitField = document.getElementById("edit-liability-credit-limit-field");
const editLiabilityCreditCardCurrentAmountField = document.getElementById("edit-liability-credit-card-current-amount-field");
const editLiabilityCreditCardMinimumPaymentField = document.getElementById("edit-liability-credit-card-minimum-payment-field");
const editLiabilityCurrentAmountInput = document.getElementById("edit-liability-current-amount");
const editLiabilityCurrentAmountHint = document.getElementById("edit-liability-current-amount-hint");
const editLiabilityInstallmentAmountInput = document.getElementById("edit-liability-installment-amount");
const editLiabilityCreditLimitInput = document.getElementById("edit-liability-credit-limit");
const editLiabilityCreditCardCurrentAmountInput = document.getElementById("edit-liability-credit-card-current-amount");
const editLiabilityCreditCardMinimumPaymentInput = document.getElementById("edit-liability-credit-card-minimum-payment");
const editLiabilityRepaymentStartDateInput = document.getElementById("edit-liability-repayment-start-date");
const editLiabilityEndDateInput = document.getElementById("edit-liability-end-date");
const editLiabilityInstallmentCountField = document.getElementById("edit-liability-installment-count-field");
const editLiabilityInstallmentCountInput = document.getElementById("edit-liability-installment-count");
const editLiabilityFirstRepaymentDayField = document.getElementById("edit-liability-first-repayment-day-field");
const editLiabilityFirstRepaymentDayInput = document.getElementById("edit-liability-first-repayment-day");
const editLiabilityScheduleModeField = document.getElementById("edit-liability-schedule-mode-field");
const editLiabilityScheduleModeSelect = document.getElementById("edit-liability-schedule-mode");
const editLiabilityEndDateField = document.getElementById("edit-liability-end-date-field");
const editLiabilityStatusSelect = document.getElementById("edit-liability-status");
const editLiabilityNoteInput = document.getElementById("edit-liability-note");
const newLiabilityRepaymentModalElement = document.querySelector("#new-liability-repayment-modal");
const newLiabilityRepaymentModal = MoneySnapshotUi.createModal({
    modalSelector: "#new-liability-repayment-modal",
    closeSelectors: ["#new-liability-repayment-modal [data-new-liability-repayment-modal-close]"]
});
const newLiabilityRepaymentForm = document.getElementById("new-liability-repayment-form");
const newLiabilityRepaymentFormMessageContainer = document.getElementById("new-liability-repayment-form-message-container");
const newLiabilityRepaymentFormMessage = document.getElementById("new-liability-repayment-form-message");
const newLiabilityRepaymentSubmitButton = document.getElementById("new-liability-repayment-submit");
const newLiabilityRepaymentSelect = document.getElementById("new-liability-repayment-liability");
const newLiabilityRepaymentDateInput = document.getElementById("new-liability-repayment-date");
const newLiabilityRepaymentSourceTypeInput = document.getElementById("new-liability-repayment-source-type");
const newLiabilityRepaymentSourceAmountInput = document.getElementById("new-liability-repayment-source-amount");
const newLiabilityRepaymentFinalAmountInput = document.getElementById("new-liability-repayment-final-amount");
const newLiabilityRepaymentSourceLabel = document.getElementById("new-liability-repayment-source-label");
const newLiabilityRepaymentNoteInput = document.getElementById("new-liability-repayment-note");
const editLiabilityRepaymentModalElement = document.querySelector("#edit-liability-repayment-modal");
const editLiabilityRepaymentModal = MoneySnapshotUi.createModal({
    modalSelector: "#edit-liability-repayment-modal",
    closeSelectors: ["#edit-liability-repayment-modal [data-edit-liability-repayment-modal-close]"]
});
const editLiabilityRepaymentForm = document.getElementById("edit-liability-repayment-form");
const editLiabilityRepaymentFormMessageContainer = document.getElementById("edit-liability-repayment-form-message-container");
const editLiabilityRepaymentFormMessage = document.getElementById("edit-liability-repayment-form-message");
const editLiabilityRepaymentSubmitButton = document.getElementById("edit-liability-repayment-submit");
const editLiabilityRepaymentSelect = document.getElementById("edit-liability-repayment-liability");
const editLiabilityRepaymentDateInput = document.getElementById("edit-liability-repayment-date");
const editLiabilityRepaymentSourceTypeInput = document.getElementById("edit-liability-repayment-source-type");
const editLiabilityRepaymentSourceAmountInput = document.getElementById("edit-liability-repayment-source-amount");
const editLiabilityRepaymentFinalAmountInput = document.getElementById("edit-liability-repayment-final-amount");
const editLiabilityRepaymentSourceLabel = document.getElementById("edit-liability-repayment-source-label");
const editLiabilityRepaymentNoteInput = document.getElementById("edit-liability-repayment-note");
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
let liabilityFormMessages = {};
let liabilityRepaymentMessages = {};
let userSettings = null;
let cachedDashboard = null;
let dashboardLoaded = false;
let selectedCreditCardLiability = null;
let cachedBanks = [];
let newLiabilityFirstRepaymentDayManuallyEdited = false;
let selectedNewRepaymentLiabilityId = "";
let selectedEditLiabilityId = "";
let loadedEditLiability = null;
let editLiabilityFirstRepaymentDayManuallyEdited = false;
let selectedEditRepaymentLiability = null;
let selectedEditRepayment = null;

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

function shouldOpenModalFromClick(event) {
    return event.button === 0
        && !event.defaultPrevented
        && !event.metaKey
        && !event.ctrlKey
        && !event.shiftKey
        && !event.altKey;
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

function setNewLiabilityFormMessage(text, type = "") {
    if (!newLiabilityFormMessage) {
        return;
    }

    newLiabilityFormMessage.textContent = text;
    newLiabilityFormMessage.dataset.type = type;
    if (newLiabilityFormMessageContainer) {
        newLiabilityFormMessageContainer.dataset.type = type || "error";
        newLiabilityFormMessageContainer.hidden = !text;
    }
}

function newLiabilityFormControls() {
    return {
        name: newLiabilityNameInput,
        bankName: newLiabilityBankSelect,
        liabilityTypeCode: newLiabilityTypeSelect,
        currentAmount: newLiabilityTypeSelect?.value === "CREDIT_CARD" ? newLiabilityCreditCardCurrentAmountInput : newLiabilityCurrentAmountInput,
        installmentAmount: newLiabilityInstallmentAmountInput,
        creditCardLimit: newLiabilityCreditLimitInput,
        creditCardMinimumPayment: newLiabilityCreditCardMinimumPaymentInput,
        endDate: newLiabilityEndDateInput,
        installmentCount: newLiabilityInstallmentCountInput,
        status: newLiabilityStatusSelect
    };
}

function clearNewLiabilityFieldHighlights() {
    Object.values(newLiabilityFormControls()).forEach((input) => input?.removeAttribute("aria-invalid"));
}

function highlightNewLiabilityField(input) {
    input?.setAttribute("aria-invalid", "true");
}

function applyNewLiabilityFieldHighlights(fieldErrors = {}) {
    const controls = newLiabilityFormControls();
    Object.entries(fieldErrors).forEach(([fieldName, hasError]) => {
        if (!hasError) {
            return;
        }
        highlightNewLiabilityField(controls[fieldName]);
    });
}

function focusFirstNewLiabilityHighlightedField() {
    Object.values(newLiabilityFormControls()).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
}

function setNewLiabilityFieldVisibility(field, visible) {
    if (!field) {
        return;
    }

    field.hidden = !visible;
    field.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = !visible;
    });
}

function todayIsoDate() {
    return MoneySnapshotUi.localIsoDate();
}

function dayOfMonthFromIsoDate(isoDate) {
    const [, , day] = `${isoDate}`.split("-");
    const parsedDay = Number.parseInt(day ?? "", 10);
    return Number.isNaN(parsedDay) ? "" : String(parsedDay);
}

function setNewLiabilityFirstRepaymentDayValue(value, {markManualEdit = false} = {}) {
    if (!newLiabilityFirstRepaymentDayInput) {
        return;
    }

    newLiabilityFirstRepaymentDayInput.value = value ?? "";
    if (markManualEdit) {
        newLiabilityFirstRepaymentDayManuallyEdited = true;
    }
}

function syncNewLiabilityRepaymentDayWithStartDate(force = false) {
    if (!newLiabilityRepaymentStartDateInput || !newLiabilityFirstRepaymentDayInput) {
        return;
    }

    if (!force && newLiabilityFirstRepaymentDayManuallyEdited) {
        return;
    }

    const repaymentDay = dayOfMonthFromIsoDate(newLiabilityRepaymentStartDateInput.value);
    if (repaymentDay) {
        setNewLiabilityFirstRepaymentDayValue(repaymentDay);
    }
}

function initializeNewLiabilityDateDefaults() {
    const today = todayIsoDate();

    if (newLiabilityRepaymentStartDateInput) {
        newLiabilityRepaymentStartDateInput.value = today;
    }

    if (newLiabilityEndDateInput) {
        newLiabilityEndDateInput.value = today;
    }

    newLiabilityFirstRepaymentDayManuallyEdited = false;
    syncNewLiabilityRepaymentDayWithStartDate(true);
}

function updateNewLiabilityAmountFields() {
    if (!newLiabilityTypeSelect) {
        return;
    }

    const isCreditCard = newLiabilityTypeSelect.value === "CREDIT_CARD";
    setNewLiabilityFieldVisibility(newLiabilityCurrentAmountField, !isCreditCard);
    setNewLiabilityFieldVisibility(newLiabilityInstallmentAmountField, !isCreditCard);
    setNewLiabilityFieldVisibility(newLiabilityCreditLimitField, isCreditCard);
    setNewLiabilityFieldVisibility(newLiabilityCreditCardCurrentAmountField, isCreditCard);
    setNewLiabilityFieldVisibility(newLiabilityCreditCardMinimumPaymentField, isCreditCard);
}

function updateNewLiabilityScheduleFields() {
    if (!newLiabilityTypeSelect || !newLiabilityScheduleModeSelect) {
        return;
    }

    const type = newLiabilityTypeSelect.value;
    const scheduleMode = newLiabilityScheduleModeSelect.value;

    const showEndDate = type === "MORTGAGE"
        || type === "CONSUMER_LOAN"
        || (type === "OTHER" && scheduleMode === "END_DATE");
    const showInstallmentPlan = type === "LEASING"
        || type === "INSTALLMENTS"
        || (type === "OTHER" && scheduleMode === "INSTALLMENTS");
    const showRepaymentDay = type === "MORTGAGE"
        || type === "CONSUMER_LOAN"
        || type === "CREDIT_CARD"
        || showInstallmentPlan;
    const showScheduleMode = type === "OTHER";

    setNewLiabilityFieldVisibility(newLiabilityScheduleModeField, showScheduleMode);
    setNewLiabilityFieldVisibility(newLiabilityEndDateField, showEndDate);
    setNewLiabilityFieldVisibility(newLiabilityInstallmentCountField, showInstallmentPlan);
    setNewLiabilityFieldVisibility(newLiabilityFirstRepaymentDayField, showRepaymentDay);
}

function setEditLiabilityFormMessage(text, type = "") {
    if (!editLiabilityFormMessage) {
        return;
    }

    editLiabilityFormMessage.textContent = text;
    editLiabilityFormMessage.dataset.type = type;
    if (editLiabilityFormMessageContainer) {
        editLiabilityFormMessageContainer.dataset.type = type || "error";
        editLiabilityFormMessageContainer.hidden = !text;
    }
}

function editLiabilityFormControls() {
    return {
        name: editLiabilityNameInput,
        bankName: editLiabilityBankSelect,
        liabilityTypeCode: editLiabilityTypeSelect,
        currentAmount: editLiabilityTypeSelect?.value === "CREDIT_CARD" ? editLiabilityCreditCardCurrentAmountInput : editLiabilityCurrentAmountInput,
        installmentAmount: editLiabilityInstallmentAmountInput,
        creditCardLimit: editLiabilityCreditLimitInput,
        creditCardMinimumPayment: editLiabilityCreditCardMinimumPaymentInput,
        endDate: editLiabilityEndDateInput,
        installmentCount: editLiabilityInstallmentCountInput,
        status: editLiabilityStatusSelect
    };
}

function clearEditLiabilityFieldHighlights() {
    Object.values(editLiabilityFormControls()).forEach((input) => input?.removeAttribute("aria-invalid"));
}

function applyEditLiabilityFieldHighlights(fieldErrors = {}) {
    const controls = editLiabilityFormControls();
    Object.entries(fieldErrors).forEach(([fieldName, hasError]) => {
        if (!hasError) {
            return;
        }
        highlightNewLiabilityField(controls[fieldName]);
    });
}

function focusFirstEditLiabilityHighlightedField() {
    Object.values(editLiabilityFormControls()).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
}

function setEditLiabilityFieldVisibility(field, visible) {
    if (!field) {
        return;
    }

    field.hidden = !visible;
    field.querySelectorAll("input, select, textarea").forEach((input) => {
        input.disabled = !visible;
    });
}

function setEditLiabilityFirstRepaymentDayValue(value, {markManualEdit = false} = {}) {
    if (!editLiabilityFirstRepaymentDayInput) {
        return;
    }

    editLiabilityFirstRepaymentDayInput.value = value ?? "";
    if (markManualEdit) {
        editLiabilityFirstRepaymentDayManuallyEdited = true;
    }
}

function syncEditLiabilityRepaymentDayWithStartDate(force = false) {
    if (!editLiabilityRepaymentStartDateInput || !editLiabilityFirstRepaymentDayInput) {
        return;
    }

    if (!force && editLiabilityFirstRepaymentDayManuallyEdited) {
        return;
    }

    const repaymentDay = dayOfMonthFromIsoDate(editLiabilityRepaymentStartDateInput.value);
    if (repaymentDay) {
        setEditLiabilityFirstRepaymentDayValue(repaymentDay);
    }
}

function updateEditLiabilityAmountFields() {
    if (!editLiabilityTypeSelect) {
        return;
    }

    const isCreditCard = editLiabilityTypeSelect.value === "CREDIT_CARD";
    setEditLiabilityFieldVisibility(editLiabilityCurrentAmountField, !isCreditCard);
    setEditLiabilityFieldVisibility(editLiabilityInstallmentAmountField, !isCreditCard);
    setEditLiabilityFieldVisibility(editLiabilityCreditLimitField, isCreditCard);
    setEditLiabilityFieldVisibility(editLiabilityCreditCardCurrentAmountField, isCreditCard);
    setEditLiabilityFieldVisibility(editLiabilityCreditCardMinimumPaymentField, isCreditCard);
}

function updateEditLiabilityScheduleFields() {
    if (!editLiabilityTypeSelect || !editLiabilityScheduleModeSelect) {
        return;
    }

    const type = editLiabilityTypeSelect.value;
    const scheduleMode = editLiabilityScheduleModeSelect.value;

    const showEndDate = type === "MORTGAGE"
        || type === "CONSUMER_LOAN"
        || (type === "OTHER" && scheduleMode === "END_DATE");
    const showInstallmentPlan = type === "LEASING"
        || type === "INSTALLMENTS"
        || (type === "OTHER" && scheduleMode === "INSTALLMENTS");
    const showRepaymentDay = type === "MORTGAGE"
        || type === "CONSUMER_LOAN"
        || type === "CREDIT_CARD"
        || showInstallmentPlan;
    const showScheduleMode = type === "OTHER";

    setEditLiabilityFieldVisibility(editLiabilityScheduleModeField, showScheduleMode);
    setEditLiabilityFieldVisibility(editLiabilityEndDateField, showEndDate);
    setEditLiabilityFieldVisibility(editLiabilityInstallmentCountField, showInstallmentPlan);
    setEditLiabilityFieldVisibility(editLiabilityFirstRepaymentDayField, showRepaymentDay);
}

function lockEditLiabilityCurrentAmountWhenRepaymentsExist() {
    if (!editLiabilityCurrentAmountInput) {
        return;
    }

    const hasRepayments = Array.isArray(loadedEditLiability?.repayments) && loadedEditLiability.repayments.length > 0;
    const isCreditCard = loadedEditLiability?.liabilityTypeCode === "CREDIT_CARD";
    const shouldLock = hasRepayments && !isCreditCard;

    editLiabilityCurrentAmountInput.readOnly = shouldLock;
    editLiabilityCurrentAmountInput.setAttribute("aria-readonly", shouldLock ? "true" : "false");

    if (editLiabilityCurrentAmountHint) {
        editLiabilityCurrentAmountHint.hidden = !shouldLock;
        editLiabilityCurrentAmountHint.textContent = shouldLock
            ? (liabilityFormMessages["liabilityForm.form.currentAmountLockedHint"] ?? editLiabilityCurrentAmountHint.textContent)
            : "";
    }
}

function renderEditLiabilityBankOptions() {
    if (!editLiabilityBankSelect) {
        return;
    }

    const selectedValue = editLiabilityBankSelect.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = liabilityFormMessages["liabilityForm.form.bankPlaceholder"] ?? "Wybierz bank";

    editLiabilityBankSelect.replaceChildren(
        placeholder,
        ...cachedBanks.map((bank) => {
            const option = document.createElement("option");
            option.value = bank.name;
            option.textContent = bank.name;
            return option;
        })
    );

    if (selectedValue) {
        editLiabilityBankSelect.value = selectedValue;
    }
}

function editLiabilityPayloadFromForm() {
    const liabilityTypeCode = editLiabilityTypeSelect?.value ?? "";
    const scheduleMode = editLiabilityScheduleModeSelect?.value ?? "";
    const isCreditCard = liabilityTypeCode === "CREDIT_CARD";

    return {
        name: editLiabilityNameInput?.value.trim() ?? "",
        bankName: editLiabilityBankSelect?.value ?? "",
        liabilityTypeCode,
        scheduleMode: liabilityTypeCode === "OTHER" ? scheduleMode : null,
        currentAmount: isCreditCard
            ? normalizeDecimalInput(editLiabilityCreditCardCurrentAmountInput?.value)
            : normalizeDecimalInput(editLiabilityCurrentAmountInput?.value),
        installmentAmount: isCreditCard ? null : normalizeDecimalInput(editLiabilityInstallmentAmountInput?.value),
        creditCardLimit: isCreditCard ? normalizeDecimalInput(editLiabilityCreditLimitInput?.value) : null,
        creditCardMinimumPayment: isCreditCard ? normalizeDecimalInput(editLiabilityCreditCardMinimumPaymentInput?.value) : null,
        repaymentStartDate: editLiabilityRepaymentStartDateInput?.value || null,
        endDate: editLiabilityEndDateInput?.value || null,
        installmentCount: normalizeIntegerInput(editLiabilityInstallmentCountInput?.value, {min: 1}),
        firstRepaymentDay: normalizeIntegerInput(editLiabilityFirstRepaymentDayInput?.value, {min: 1, max: 31}),
        note: editLiabilityNoteInput?.value.trim() ?? "",
        status: editLiabilityStatusSelect?.value ?? ""
    };
}

async function loadEditLiability(liabilityId) {
    const response = await fetch(`/api/liabilities/${encodeURIComponent(liabilityId)}`);
    if (response.status === 404) {
        throw new Error(liabilityFormMessages["liabilityForm.error.notFound"] ?? "Liability not found.");
    }
    if (!response.ok) {
        throw new Error(liabilityFormMessages["liabilityForm.error.loadLiability"] ?? "Cannot load liability.");
    }

    const liability = await response.json();
    loadedEditLiability = liability;
    selectedEditLiabilityId = liability.id;

    if (editLiabilityNameInput) {
        editLiabilityNameInput.value = liability.name ?? "";
    }
    if (editLiabilityBankSelect) {
        editLiabilityBankSelect.value = liability.bankName ?? "";
    }
    if (editLiabilityTypeSelect) {
        editLiabilityTypeSelect.value = liability.liabilityTypeCode ?? editLiabilityTypeSelect.value;
    }
    if (editLiabilityCurrentAmountInput) {
        editLiabilityCurrentAmountInput.value = `${liability.currentAmount ?? 0}`;
    }
    if (editLiabilityInstallmentAmountInput) {
        editLiabilityInstallmentAmountInput.value = `${liability.installmentAmount ?? 0}`;
    }
    if (editLiabilityCreditLimitInput) {
        editLiabilityCreditLimitInput.value = `${liability.creditCardLimit ?? 0}`;
    }
    if (editLiabilityCreditCardCurrentAmountInput) {
        editLiabilityCreditCardCurrentAmountInput.value = `${liability.currentAmount ?? 0}`;
    }
    if (editLiabilityCreditCardMinimumPaymentInput) {
        editLiabilityCreditCardMinimumPaymentInput.value = `${liability.creditCardMinimumPayment ?? 0}`;
    }
    if (editLiabilityRepaymentStartDateInput) {
        editLiabilityRepaymentStartDateInput.value = liability.repaymentStartDate ?? "";
    }
    if (editLiabilityEndDateInput) {
        editLiabilityEndDateInput.value = liability.endDate ?? "";
    }
    if (editLiabilityInstallmentCountInput) {
        editLiabilityInstallmentCountInput.value = liability.installmentCount ?? "";
    }
    if (editLiabilityFirstRepaymentDayInput) {
        if (liability.firstRepaymentDay !== null && liability.firstRepaymentDay !== undefined) {
            setEditLiabilityFirstRepaymentDayValue(liability.firstRepaymentDay, {markManualEdit: false});
            editLiabilityFirstRepaymentDayManuallyEdited = false;
        } else {
            setEditLiabilityFirstRepaymentDayValue("", {markManualEdit: false});
            editLiabilityFirstRepaymentDayManuallyEdited = false;
            syncEditLiabilityRepaymentDayWithStartDate(false);
        }
    }
    if (editLiabilityScheduleModeSelect) {
        editLiabilityScheduleModeSelect.value = liability.scheduleMode ?? editLiabilityScheduleModeSelect.value;
    }
    if (editLiabilityNoteInput) {
        editLiabilityNoteInput.value = liability.note ?? "";
    }
    if (editLiabilityStatusSelect) {
        editLiabilityStatusSelect.value = liability.status ?? editLiabilityStatusSelect.value;
    }

    updateEditLiabilityAmountFields();
    updateEditLiabilityScheduleFields();
    lockEditLiabilityCurrentAmountWhenRepaymentsExist();
    updateEditLiabilitySubmitButton(false);
}

async function saveEditedLiability(payload) {
    const response = await fetch(`/api/liabilities/${encodeURIComponent(selectedEditLiabilityId)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 409) {
        const duplicateError = new Error(liabilityFormMessages["liabilityForm.error.duplicate"] ?? "Duplicate liability");
        duplicateError.fieldErrors = {name: true};
        throw duplicateError;
    }

    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(liabilityFormMessages["liabilityForm.error.required"] ?? "Validation failed");
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        throw new Error(errorPayload?.message ?? liabilityFormMessages["liabilityForm.error.update"] ?? "Validation failed");
    }

    if (response.status === 404) {
        throw new Error(liabilityFormMessages["liabilityForm.error.notFound"] ?? "Liability not found");
    }

    if (!response.ok) {
        throw new Error(liabilityFormMessages["liabilityForm.error.update"] ?? "Cannot save liability");
    }

    return response.json();
}

function updateEditLiabilitySubmitButton(disabled) {
    if (editLiabilitySubmitButton) {
        editLiabilitySubmitButton.disabled = disabled;
    }
}

function resetEditLiabilityForm() {
    if (!editLiabilityForm) {
        return;
    }

    editLiabilityForm.reset();
    clearEditLiabilityFieldHighlights();
    setEditLiabilityFormMessage("");
    renderEditLiabilityBankOptions();
    loadedEditLiability = null;
    selectedEditLiabilityId = "";
    editLiabilityFirstRepaymentDayManuallyEdited = false;
    updateEditLiabilityAmountFields();
    updateEditLiabilityScheduleFields();
    lockEditLiabilityCurrentAmountWhenRepaymentsExist();
    updateEditLiabilitySubmitButton(true);
}

async function openEditLiabilityModal(liability, trigger) {
    await loadBanksForNewLiabilityForm();
    renderEditLiabilityBankOptions();
    resetEditLiabilityForm();
    await loadEditLiability(liability.id);
    editLiabilityModal.open({trigger});
}

function setupEditLiabilityForm() {
    if (!editLiabilityForm || !editLiabilityTypeSelect || !editLiabilityScheduleModeSelect) {
        return;
    }

    updateEditLiabilityAmountFields();
    updateEditLiabilityScheduleFields();
    updateEditLiabilitySubmitButton(true);

    editLiabilityTypeSelect.addEventListener("change", () => {
        updateEditLiabilityAmountFields();
        updateEditLiabilityScheduleFields();
    });
    editLiabilityScheduleModeSelect.addEventListener("change", updateEditLiabilityScheduleFields);
    editLiabilityRepaymentStartDateInput?.addEventListener("change", () => syncEditLiabilityRepaymentDayWithStartDate(false));
    editLiabilityFirstRepaymentDayInput?.addEventListener("input", () => {
        editLiabilityFirstRepaymentDayManuallyEdited = true;
    });
    editLiabilityFirstRepaymentDayInput?.addEventListener("change", () => {
        editLiabilityFirstRepaymentDayManuallyEdited = true;
    });

    editLiabilityForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearEditLiabilityFieldHighlights();

        const payload = editLiabilityPayloadFromForm();
        if (!newLiabilityRequiredFieldValues(payload)) {
            applyEditLiabilityFieldHighlights(newLiabilityRequiredFieldErrors(payload));
            setEditLiabilityFormMessage(liabilityFormMessages["liabilityForm.error.required"] ?? "", "error");
            focusFirstEditLiabilityHighlightedField();
            return;
        }

        updateEditLiabilitySubmitButton(true);
        setEditLiabilityFormMessage("");

        try {
            await saveEditedLiability(payload);
            editLiabilityModal.close();
            resetEditLiabilityForm();
            await loadDashboard();
            showToast(liabilitiesMessages["liabilities.form.success"] ?? "", "success");
        } catch (error) {
            if (error.fieldErrors) {
                applyEditLiabilityFieldHighlights(error.fieldErrors);
                focusFirstEditLiabilityHighlightedField();
            }
            setEditLiabilityFormMessage(error.message, "error");
            updateEditLiabilitySubmitButton(false);
            if (!error.fieldErrors) {
                editLiabilityNameInput?.focus();
            }
        }
    });

    Object.values(editLiabilityFormControls()).forEach((input) => {
        input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
        input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
    });
}

function renderNewLiabilityBankOptions() {
    if (!newLiabilityBankSelect) {
        return;
    }

    const selectedValue = newLiabilityBankSelect.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = liabilityFormMessages["liabilityForm.form.bankPlaceholder"] ?? "Wybierz bank";

    newLiabilityBankSelect.replaceChildren(
        placeholder,
        ...cachedBanks.map((bank) => {
            const option = document.createElement("option");
            option.value = bank.name;
            option.textContent = bank.name;
            return option;
        })
    );

    if (selectedValue) {
        newLiabilityBankSelect.value = selectedValue;
    }
}

async function loadBanksForNewLiabilityForm() {
    if (!newLiabilityBankSelect || cachedBanks.length > 0) {
        renderNewLiabilityBankOptions();
        return;
    }

    const response = await fetch("/api/banks");
    if (!response.ok) {
        throw new Error(liabilityFormMessages["liabilityForm.error.loadBanks"] ?? "Cannot load banks");
    }

    cachedBanks = await response.json();
    renderNewLiabilityBankOptions();
}

function normalizeIntegerInput(rawValue, {min = null, max = null} = {}) {
    const trimmedValue = `${rawValue ?? ""}`.trim();
    if (!trimmedValue) {
        return null;
    }

    if (!/^\d+$/.test(trimmedValue)) {
        return null;
    }

    const parsedValue = Number.parseInt(trimmedValue, 10);
    if (!Number.isInteger(parsedValue)) {
        return null;
    }

    if (min !== null && parsedValue < min) {
        return null;
    }

    if (max !== null && parsedValue > max) {
        return null;
    }

    return parsedValue;
}

function newLiabilityPayloadFromForm() {
    const liabilityTypeCode = newLiabilityTypeSelect?.value ?? "";
    const scheduleMode = newLiabilityScheduleModeSelect?.value ?? "";
    const isCreditCard = liabilityTypeCode === "CREDIT_CARD";

    return {
        name: newLiabilityNameInput?.value.trim() ?? "",
        bankName: newLiabilityBankSelect?.value ?? "",
        liabilityTypeCode,
        scheduleMode: liabilityTypeCode === "OTHER" ? scheduleMode : null,
        currentAmount: isCreditCard
            ? normalizeDecimalInput(newLiabilityCreditCardCurrentAmountInput?.value)
            : normalizeDecimalInput(newLiabilityCurrentAmountInput?.value),
        installmentAmount: isCreditCard ? null : normalizeDecimalInput(newLiabilityInstallmentAmountInput?.value),
        creditCardLimit: isCreditCard ? normalizeDecimalInput(newLiabilityCreditLimitInput?.value) : null,
        creditCardMinimumPayment: isCreditCard ? normalizeDecimalInput(newLiabilityCreditCardMinimumPaymentInput?.value) : null,
        repaymentStartDate: newLiabilityRepaymentStartDateInput?.value || null,
        endDate: newLiabilityEndDateInput?.value || null,
        installmentCount: normalizeIntegerInput(newLiabilityInstallmentCountInput?.value, {min: 1}),
        firstRepaymentDay: normalizeIntegerInput(newLiabilityFirstRepaymentDayInput?.value, {min: 1, max: 31}),
        note: newLiabilityNoteInput?.value.trim() ?? "",
        status: newLiabilityStatusSelect?.value ?? ""
    };
}

function newLiabilityRequiredFieldValues(payload) {
    const type = payload.liabilityTypeCode;
    const scheduleMode = payload.scheduleMode;
    const isCreditCard = type === "CREDIT_CARD";
    const requiresEndDate = type === "MORTGAGE" || type === "CONSUMER_LOAN" || (type === "OTHER" && scheduleMode === "END_DATE");
    const requiresInstallments = type === "LEASING" || type === "INSTALLMENTS" || (type === "OTHER" && scheduleMode === "INSTALLMENTS");

    if (!payload.name || !payload.bankName || !type || !payload.status) {
        return false;
    }

    if (isCreditCard) {
        return payload.creditCardLimit !== null
            && payload.currentAmount !== null
            && payload.creditCardMinimumPayment !== null;
    }

    if (payload.currentAmount === null || payload.installmentAmount === null) {
        return false;
    }

    if (requiresEndDate && !payload.endDate) {
        return false;
    }

    if (requiresInstallments && !payload.installmentCount) {
        return false;
    }

    return true;
}

function newLiabilityRequiredFieldErrors(payload) {
    const errors = {};
    const type = payload.liabilityTypeCode;
    const scheduleMode = payload.scheduleMode;
    const isCreditCard = type === "CREDIT_CARD";
    const requiresEndDate = type === "MORTGAGE" || type === "CONSUMER_LOAN" || (type === "OTHER" && scheduleMode === "END_DATE");
    const requiresInstallments = type === "LEASING" || type === "INSTALLMENTS" || (type === "OTHER" && scheduleMode === "INSTALLMENTS");

    if (!payload.name) {
        errors.name = true;
    }
    if (!payload.bankName) {
        errors.bankName = true;
    }
    if (!type) {
        errors.liabilityTypeCode = true;
    }
    if (!payload.status) {
        errors.status = true;
    }

    if (isCreditCard) {
        if (payload.currentAmount === null) {
            errors.currentAmount = true;
        }
        if (payload.creditCardLimit === null) {
            errors.creditCardLimit = true;
        }
        if (payload.creditCardMinimumPayment === null) {
            errors.creditCardMinimumPayment = true;
        }
        return errors;
    }

    if (payload.currentAmount === null) {
        errors.currentAmount = true;
    }
    if (payload.installmentAmount === null) {
        errors.installmentAmount = true;
    }
    if (requiresEndDate && !payload.endDate) {
        errors.endDate = true;
    }
    if (requiresInstallments && !payload.installmentCount) {
        errors.installmentCount = true;
    }

    return errors;
}

async function readErrorPayload(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

function updateNewLiabilitySubmitButton(disabled) {
    if (newLiabilitySubmitButton) {
        newLiabilitySubmitButton.disabled = disabled;
    }
}

async function saveNewLiability(payload) {
    const response = await fetch("/api/liabilities", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 409) {
        const duplicateError = new Error(liabilityFormMessages["liabilityForm.error.duplicate"] ?? "Duplicate liability");
        duplicateError.fieldErrors = {name: true};
        throw duplicateError;
    }

    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(liabilityFormMessages["liabilityForm.error.required"] ?? "Validation failed");
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        throw new Error(errorPayload?.message ?? liabilityFormMessages["liabilityForm.error.required"] ?? "Validation failed");
    }

    if (!response.ok) {
        throw new Error(liabilityFormMessages["liabilityForm.error.create"] ?? "Cannot save liability");
    }

    return response.json();
}

function resetNewLiabilityForm() {
    if (!newLiabilityForm) {
        return;
    }

    newLiabilityForm.reset();
    clearNewLiabilityFieldHighlights();
    setNewLiabilityFormMessage("");
    newLiabilityTypeSelect.value = "MORTGAGE";
    newLiabilityScheduleModeSelect.value = "END_DATE";
    if (newLiabilityStatusSelect) {
        newLiabilityStatusSelect.value = "ACTIVE";
    }
    if (newLiabilityCurrentAmountInput) {
        newLiabilityCurrentAmountInput.value = "0";
    }
    if (newLiabilityInstallmentAmountInput) {
        newLiabilityInstallmentAmountInput.value = "0";
    }
    if (newLiabilityCreditLimitInput) {
        newLiabilityCreditLimitInput.value = "0";
    }
    if (newLiabilityCreditCardCurrentAmountInput) {
        newLiabilityCreditCardCurrentAmountInput.value = "0";
    }
    if (newLiabilityCreditCardMinimumPaymentInput) {
        newLiabilityCreditCardMinimumPaymentInput.value = "0";
    }
    if (newLiabilityInstallmentCountInput) {
        newLiabilityInstallmentCountInput.value = "";
    }
    if (newLiabilityFirstRepaymentDayInput) {
        newLiabilityFirstRepaymentDayInput.value = "";
    }
    initializeNewLiabilityDateDefaults();
    updateNewLiabilityAmountFields();
    updateNewLiabilityScheduleFields();
    renderNewLiabilityBankOptions();
    updateNewLiabilitySubmitButton(false);
}

async function loadLiabilityFormMessages(language) {
    const response = await fetch(`/api/liability-form/messages?lang=${encodeURIComponent(language)}`);
    if (!response.ok) {
        throw new Error("Cannot load liability form messages");
    }

    liabilityFormMessages = await response.json();
    if (newLiabilityModalElement) {
        MoneySnapshotI18n.applyMessages(
            liabilityFormMessages,
            language,
            newLiabilityModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
        );
    }
    if (editLiabilityModalElement) {
        MoneySnapshotI18n.applyMessages(
            liabilityFormMessages,
            language,
            editLiabilityModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
        );
    }
    renderNewLiabilityBankOptions();
    renderEditLiabilityBankOptions();
}

async function openNewLiabilityModal(trigger) {
    await loadBanksForNewLiabilityForm();
    resetNewLiabilityForm();
    newLiabilityModal.open({trigger});
}

function setupNewLiabilityForm() {
    if (!newLiabilityForm || !newLiabilityTypeSelect || !newLiabilityScheduleModeSelect) {
        return;
    }

    initializeNewLiabilityDateDefaults();
    updateNewLiabilityAmountFields();
    updateNewLiabilityScheduleFields();

    newLiabilityTypeSelect.addEventListener("change", () => {
        updateNewLiabilityAmountFields();
        updateNewLiabilityScheduleFields();
    });
    newLiabilityScheduleModeSelect.addEventListener("change", updateNewLiabilityScheduleFields);
    newLiabilityRepaymentStartDateInput?.addEventListener("change", () => syncNewLiabilityRepaymentDayWithStartDate(false));
    newLiabilityFirstRepaymentDayInput?.addEventListener("input", () => {
        newLiabilityFirstRepaymentDayManuallyEdited = true;
    });
    newLiabilityFirstRepaymentDayInput?.addEventListener("change", () => {
        newLiabilityFirstRepaymentDayManuallyEdited = true;
    });

    newLiabilityForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearNewLiabilityFieldHighlights();

        const payload = newLiabilityPayloadFromForm();
        if (!newLiabilityRequiredFieldValues(payload)) {
            applyNewLiabilityFieldHighlights(newLiabilityRequiredFieldErrors(payload));
            setNewLiabilityFormMessage(liabilityFormMessages["liabilityForm.error.required"] ?? "", "error");
            focusFirstNewLiabilityHighlightedField();
            return;
        }

        updateNewLiabilitySubmitButton(true);
        setNewLiabilityFormMessage("");

        try {
            await saveNewLiability(payload);
            newLiabilityModal.close();
            resetNewLiabilityForm();
            await loadDashboard();
            showToast(liabilitiesMessages["liabilities.form.success"] ?? "", "success");
        } catch (error) {
            if (error.fieldErrors) {
                applyNewLiabilityFieldHighlights(error.fieldErrors);
                focusFirstNewLiabilityHighlightedField();
            }
            setNewLiabilityFormMessage(error.message, "error");
            updateNewLiabilitySubmitButton(false);
            if (!error.fieldErrors) {
                newLiabilityNameInput?.focus();
            }
        }
    });

    Object.values(newLiabilityFormControls()).forEach((input) => {
        input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
        input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
    });

    if (newLiabilityAction) {
        newLiabilityAction.addEventListener("click", async (event) => {
            if (!shouldOpenModalFromClick(event)) {
                return;
            }

            event.preventDefault();

            try {
                await openNewLiabilityModal(newLiabilityAction);
            } catch (error) {
                showToast(error.message, "error");
                window.location.href = newLiabilityAction.href;
            }
        });
    }
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

function setNewLiabilityRepaymentFormMessage(text, type = "") {
    if (!newLiabilityRepaymentFormMessage) {
        return;
    }

    newLiabilityRepaymentFormMessage.textContent = text;
    newLiabilityRepaymentFormMessage.dataset.type = type;
    if (newLiabilityRepaymentFormMessageContainer) {
        newLiabilityRepaymentFormMessageContainer.dataset.type = type || "error";
        newLiabilityRepaymentFormMessageContainer.hidden = !text;
    }
}

function setEditLiabilityRepaymentFormMessage(text, type = "") {
    if (!editLiabilityRepaymentFormMessage) {
        return;
    }

    editLiabilityRepaymentFormMessage.textContent = text;
    editLiabilityRepaymentFormMessage.dataset.type = type;
    if (editLiabilityRepaymentFormMessageContainer) {
        editLiabilityRepaymentFormMessageContainer.dataset.type = type || "error";
        editLiabilityRepaymentFormMessageContainer.hidden = !text;
    }
}

const newLiabilityRepaymentFormControls = {
    liabilityId: newLiabilityRepaymentSelect,
    repaymentDate: newLiabilityRepaymentDateInput,
    sourceType: newLiabilityRepaymentSourceTypeInput,
    sourceAmount: newLiabilityRepaymentSourceAmountInput
};

const editLiabilityRepaymentFormControls = {
    liabilityId: editLiabilityRepaymentSelect,
    repaymentDate: editLiabilityRepaymentDateInput,
    sourceType: editLiabilityRepaymentSourceTypeInput,
    sourceAmount: editLiabilityRepaymentSourceAmountInput
};

function clearNewLiabilityRepaymentFieldHighlights() {
    Object.values(newLiabilityRepaymentFormControls).forEach((input) => input?.removeAttribute("aria-invalid"));
}

function applyNewLiabilityRepaymentFieldHighlights(fieldErrors = {}) {
    if (fieldErrors.liabilityId) {
        highlightNewLiabilityField(newLiabilityRepaymentSelect);
    }
    if (fieldErrors.repaymentDate) {
        highlightNewLiabilityField(newLiabilityRepaymentDateInput);
    }
    if (fieldErrors.sourceType) {
        highlightNewLiabilityField(newLiabilityRepaymentSourceTypeInput);
    }
    if (fieldErrors.sourceAmount) {
        highlightNewLiabilityField(newLiabilityRepaymentSourceAmountInput);
    }
}

function focusFirstNewLiabilityRepaymentHighlightedField() {
    Object.values(newLiabilityRepaymentFormControls).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
}

function clearEditLiabilityRepaymentFieldHighlights() {
    Object.values(editLiabilityRepaymentFormControls).forEach((input) => input?.removeAttribute("aria-invalid"));
}

function applyEditLiabilityRepaymentFieldHighlights(fieldErrors = {}) {
    if (fieldErrors.liabilityId) {
        highlightNewLiabilityField(editLiabilityRepaymentSelect);
    }
    if (fieldErrors.repaymentDate) {
        highlightNewLiabilityField(editLiabilityRepaymentDateInput);
    }
    if (fieldErrors.sourceType) {
        highlightNewLiabilityField(editLiabilityRepaymentSourceTypeInput);
    }
    if (fieldErrors.sourceAmount) {
        highlightNewLiabilityField(editLiabilityRepaymentSourceAmountInput);
    }
}

function focusFirstEditLiabilityRepaymentHighlightedField() {
    Object.values(editLiabilityRepaymentFormControls).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
}

function newLiabilityRepaymentSourceType() {
    return newLiabilityRepaymentSourceTypeInput?.value === "CURRENT_AMOUNT" ? "CURRENT_AMOUNT" : "REPAYMENT_AMOUNT";
}

function selectedNewRepaymentLiability() {
    return cachedDashboard?.liabilities?.find((liability) => liability.id === newLiabilityRepaymentSelect?.value) ?? null;
}

function editRepaymentSourceType() {
    return editLiabilityRepaymentSourceTypeInput?.value === "CURRENT_AMOUNT" ? "CURRENT_AMOUNT" : "REPAYMENT_AMOUNT";
}

function repaymentDateForEditSelection(repayment) {
    if (repayment?.id === selectedEditRepayment?.id) {
        return editLiabilityRepaymentDateInput?.value || selectedEditRepayment.repaymentDate || "";
    }

    return repayment?.repaymentDate ?? "";
}

function compareRepaymentsAscendingLocal(left, right) {
    const repaymentDateDiff = `${left.repaymentDate ?? ""}`.localeCompare(`${right.repaymentDate ?? ""}`);
    if (repaymentDateDiff !== 0) {
        return repaymentDateDiff;
    }

    return `${left.createdAt ?? ""}`.localeCompare(`${right.createdAt ?? ""}`);
}

function compareRepaymentsForEditSelection(left, right) {
    const repaymentDateDiff = repaymentDateForEditSelection(left).localeCompare(repaymentDateForEditSelection(right));
    if (repaymentDateDiff !== 0) {
        return repaymentDateDiff;
    }

    return `${left.createdAt ?? ""}`.localeCompare(`${right.createdAt ?? ""}`);
}

function repaymentReplayStartingBalanceLocal(liability, repayments) {
    if (liability?.liabilityTypeCode !== "CREDIT_CARD") {
        return Number(liability?.originalAmount ?? 0);
    }

    const firstRepayment = repayments[0];
    if (!firstRepayment) {
        return Number(liability?.currentAmount ?? 0);
    }

    return Number(firstRepayment.currentAmount ?? 0) + Number(firstRepayment.amount ?? 0);
}

function baseCurrentAmountForEditRepayment() {
    if (!selectedEditRepaymentLiability || !selectedEditRepayment) {
        return 0;
    }

    const savedRepayments = [...(selectedEditRepaymentLiability.repayments ?? [])].sort(compareRepaymentsAscendingLocal);
    const replayRepayments = [...(selectedEditRepaymentLiability.repayments ?? [])].sort(compareRepaymentsForEditSelection);
    let currentAmount = repaymentReplayStartingBalanceLocal(selectedEditRepaymentLiability, savedRepayments);

    for (const repayment of replayRepayments) {
        if (repayment.id === selectedEditRepayment.id) {
            break;
        }

        currentAmount -= Number(repayment.amount ?? 0);
    }

    return currentAmount;
}

function selectedNewRepaymentLiabilityCurrentAmount() {
    return selectedNewRepaymentLiability()?.currentAmount ?? 0;
}

function applyNewRepaymentSourceFieldLabel() {
    if (!newLiabilityRepaymentSourceLabel) {
        return;
    }

    newLiabilityRepaymentSourceLabel.textContent = newLiabilityRepaymentSourceType() === "CURRENT_AMOUNT"
        ? (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountCurrentAmount"] ?? "Aktualne saldo")
        : (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountRepaymentAmount"] ?? "Kwota spłaty");
}

function updateNewRepaymentFinalAmountPreview() {
    if (!newLiabilityRepaymentFinalAmountInput) {
        return;
    }

    const rawValue = normalizeDecimalInput(newLiabilityRepaymentSourceAmountInput?.value);
    if (rawValue === null) {
        newLiabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    const sourceValue = Number(rawValue);
    if (!Number.isFinite(sourceValue)) {
        newLiabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    if (newLiabilityRepaymentSourceType() === "CURRENT_AMOUNT") {
        newLiabilityRepaymentFinalAmountInput.value = formatMoney(sourceValue);
        return;
    }

    newLiabilityRepaymentFinalAmountInput.value = formatMoney(selectedNewRepaymentLiabilityCurrentAmount() - sourceValue);
}

function applyEditRepaymentSourceFieldLabel() {
    if (!editLiabilityRepaymentSourceLabel) {
        return;
    }

    editLiabilityRepaymentSourceLabel.textContent = editRepaymentSourceType() === "CURRENT_AMOUNT"
        ? (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountCurrentAmount"] ?? "Aktualne saldo")
        : (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountRepaymentAmount"] ?? "Kwota spłaty");
}

function updateEditRepaymentFinalAmountPreview() {
    if (!editLiabilityRepaymentFinalAmountInput) {
        return;
    }

    const rawValue = normalizeDecimalInput(editLiabilityRepaymentSourceAmountInput?.value);
    if (rawValue === null) {
        editLiabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    const sourceValue = Number(rawValue);
    if (!Number.isFinite(sourceValue)) {
        editLiabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    if (editRepaymentSourceType() === "CURRENT_AMOUNT") {
        editLiabilityRepaymentFinalAmountInput.value = formatMoney(sourceValue);
        return;
    }

    editLiabilityRepaymentFinalAmountInput.value = formatMoney(baseCurrentAmountForEditRepayment() - sourceValue);
}

function syncEditRepaymentSourceAmountFromSelection() {
    if (!editLiabilityRepaymentSourceAmountInput || !selectedEditRepayment) {
        return;
    }

    editLiabilityRepaymentSourceAmountInput.value = editRepaymentSourceType() === "CURRENT_AMOUNT"
        ? `${selectedEditRepayment.currentAmount ?? 0}`
        : `${selectedEditRepayment.amount ?? 0}`;
    updateEditRepaymentFinalAmountPreview();
}

function syncNewRepaymentSourceAmountFromSelection() {
    if (!newLiabilityRepaymentSourceAmountInput) {
        return;
    }

    const currentAmount = Number(selectedNewRepaymentLiabilityCurrentAmount() ?? 0);
    newLiabilityRepaymentSourceAmountInput.value = newLiabilityRepaymentSourceType() === "CURRENT_AMOUNT" ? `${currentAmount}` : "0";
    updateNewRepaymentFinalAmountPreview();
}

function setNewRepaymentInputsEnabled(hasLiabilities) {
    if (newLiabilityRepaymentSourceTypeInput) {
        newLiabilityRepaymentSourceTypeInput.disabled = !hasLiabilities;
    }
    if (newLiabilityRepaymentSourceAmountInput) {
        newLiabilityRepaymentSourceAmountInput.disabled = !hasLiabilities;
    }
    if (newLiabilityRepaymentFinalAmountInput) {
        newLiabilityRepaymentFinalAmountInput.disabled = !hasLiabilities;
    }
}

function renderNewRepaymentLiabilityOptions() {
    if (!newLiabilityRepaymentSelect) {
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = liabilityRepaymentMessages["liabilityRepayment.form.liabilityPlaceholder"] ?? "";

    const liabilities = cachedDashboard?.liabilities ?? [];
    newLiabilityRepaymentSelect.replaceChildren(
        placeholder,
        ...liabilities.map((liability) => {
            const option = document.createElement("option");
            option.value = liability.id;
            option.textContent = `${liability.name} · ${liability.bankName} · ${formatMoney(liability.currentAmount)}`;
            return option;
        })
    );

    if (selectedNewRepaymentLiabilityId) {
        newLiabilityRepaymentSelect.value = selectedNewRepaymentLiabilityId;
    }

    const hasLiabilities = liabilities.length > 0;
    newLiabilityRepaymentSelect.disabled = !hasLiabilities;
    setNewRepaymentInputsEnabled(hasLiabilities);
    if (newLiabilityRepaymentSubmitButton) {
        newLiabilityRepaymentSubmitButton.disabled = !hasLiabilities;
    }

    if (!hasLiabilities) {
        setNewLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.noLiabilities"] ?? "", "error");
    } else if (newLiabilityRepaymentFormMessage?.dataset.type === "error") {
        setNewLiabilityRepaymentFormMessage("", "");
    }

    applyNewRepaymentSourceFieldLabel();
    syncNewRepaymentSourceAmountFromSelection();
}

function renderEditRepaymentLiabilityOptions() {
    if (!editLiabilityRepaymentSelect) {
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = liabilityRepaymentMessages["liabilityRepayment.form.liabilityPlaceholder"] ?? "";

    const liabilities = cachedDashboard?.liabilities ?? [];
    editLiabilityRepaymentSelect.replaceChildren(
        placeholder,
        ...liabilities.map((liability) => {
            const option = document.createElement("option");
            option.value = liability.id;
            option.textContent = `${liability.name} · ${liability.bankName} · ${formatMoney(liability.currentAmount)}`;
            return option;
        })
    );

    if (selectedEditRepaymentLiability?.id) {
        editLiabilityRepaymentSelect.value = selectedEditRepaymentLiability.id;
    }

    const hasLiabilities = liabilities.length > 0;
    editLiabilityRepaymentSelect.disabled = true;
    if (editLiabilityRepaymentSourceTypeInput) {
        editLiabilityRepaymentSourceTypeInput.disabled = !hasLiabilities;
    }
    if (editLiabilityRepaymentSourceAmountInput) {
        editLiabilityRepaymentSourceAmountInput.disabled = !hasLiabilities;
    }
    if (editLiabilityRepaymentFinalAmountInput) {
        editLiabilityRepaymentFinalAmountInput.disabled = !hasLiabilities;
    }
    if (editLiabilityRepaymentSubmitButton) {
        editLiabilityRepaymentSubmitButton.disabled = !hasLiabilities || !selectedEditRepayment;
    }

    applyEditRepaymentSourceFieldLabel();
    syncEditRepaymentSourceAmountFromSelection();
}

function initializeNewRepaymentDateDefaults() {
    if (newLiabilityRepaymentDateInput && !newLiabilityRepaymentDateInput.value) {
        newLiabilityRepaymentDateInput.value = todayIsoDate();
    }
}

function newRepaymentPayloadFromForm() {
    return {
        repaymentDate: newLiabilityRepaymentDateInput?.value || null,
        sourceType: newLiabilityRepaymentSourceType(),
        sourceAmount: normalizeDecimalInput(newLiabilityRepaymentSourceAmountInput?.value),
        note: newLiabilityRepaymentNoteInput?.value.trim() ?? ""
    };
}

function editRepaymentPayloadFromForm() {
    return {
        repaymentDate: editLiabilityRepaymentDateInput?.value || null,
        sourceType: editRepaymentSourceType(),
        sourceAmount: normalizeDecimalInput(editLiabilityRepaymentSourceAmountInput?.value),
        note: editLiabilityRepaymentNoteInput?.value.trim() ?? ""
    };
}

function validateNewRepaymentPayload(payload) {
    if (!newLiabilityRepaymentSelect?.value || !payload.repaymentDate || !payload.sourceType || !payload.sourceAmount) {
        return "required";
    }

    const selected = selectedNewRepaymentLiability();
    if (!selected) {
        return "required";
    }

    const sourceValue = Number(payload.sourceAmount);
    const baseValue = Number(selected.currentAmount ?? 0);
    if (!Number.isFinite(sourceValue) || sourceValue < 0 || sourceValue > baseValue) {
        return "exceedsBalance";
    }

    return "";
}

function validateEditRepaymentPayload(payload) {
    if (!selectedEditRepaymentLiability?.id || !payload.repaymentDate || !payload.sourceType || !payload.sourceAmount) {
        return "required";
    }

    const sourceValue = Number(payload.sourceAmount);
    const baseValue = baseCurrentAmountForEditRepayment();
    if (!Number.isFinite(sourceValue) || sourceValue < 0 || sourceValue > baseValue) {
        return "exceedsBalance";
    }

    return "";
}

async function saveNewRepayment(liabilityId, payload) {
    const response = await fetch(`/api/liabilities/${encodeURIComponent(liabilityId)}/repayments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 404) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.repaymentNotFound"] ?? "Repayment not found.");
    }

    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "Validation failed.");
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        if (errorPayload?.message === "Repayments can only be registered for active liabilities.") {
            const inactiveLiabilityError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.inactiveLiability"] ?? "Repayments can only be registered for active liabilities.");
            inactiveLiabilityError.fieldErrors = {liabilityId: "inactive"};
            throw inactiveLiabilityError;
        }
        if (errorPayload?.message === "Repayment amount cannot exceed current liability amount.") {
            const amountError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "Validation failed.");
            amountError.fieldErrors = {sourceAmount: "exceedsBalance"};
            throw amountError;
        }
        throw new Error(errorPayload?.message ?? liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "Validation failed.");
    }

    if (!response.ok) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.create"] ?? "Cannot save repayment.");
    }

    return response.json();
}

async function saveEditedRepayment(payload) {
    const response = await fetch(`/api/liabilities/repayments/${encodeURIComponent(selectedEditRepayment?.id ?? "")}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 404) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.repaymentNotFound"] ?? "Repayment not found.");
    }

    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "Validation failed.");
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        if (errorPayload?.message === "Repayments can only be registered for active liabilities.") {
            const inactiveLiabilityError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.inactiveLiability"] ?? "Repayments can only be registered for active liabilities.");
            inactiveLiabilityError.fieldErrors = {liabilityId: "inactive"};
            throw inactiveLiabilityError;
        }
        if (errorPayload?.message === "Repayment amount cannot exceed current liability amount.") {
            const amountError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "Validation failed.");
            amountError.fieldErrors = {sourceAmount: "exceedsBalance"};
            throw amountError;
        }
        throw new Error(errorPayload?.message ?? liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "Validation failed.");
    }

    if (!response.ok) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.update"] ?? "Cannot save repayment.");
    }

    return response.json();
}

function updateNewLiabilityRepaymentSubmitButton(disabled) {
    if (newLiabilityRepaymentSubmitButton) {
        newLiabilityRepaymentSubmitButton.disabled = disabled;
    }
}

async function loadLiabilityRepaymentMessages(language) {
    const response = await fetch(`/api/liability-repayment/messages?lang=${encodeURIComponent(language)}`);
    if (!response.ok) {
        throw new Error("Cannot load liability repayment messages");
    }

    liabilityRepaymentMessages = await response.json();
    if (newLiabilityRepaymentModalElement) {
        MoneySnapshotI18n.applyMessages(
            liabilityRepaymentMessages,
            language,
            newLiabilityRepaymentModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
        );
    }
    if (editLiabilityRepaymentModalElement) {
        MoneySnapshotI18n.applyMessages(
            liabilityRepaymentMessages,
            language,
            editLiabilityRepaymentModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
        );
    }
    renderNewRepaymentLiabilityOptions();
    renderEditRepaymentLiabilityOptions();
}

function resetNewLiabilityRepaymentForm() {
    if (!newLiabilityRepaymentForm) {
        return;
    }

    newLiabilityRepaymentForm.reset();
    clearNewLiabilityRepaymentFieldHighlights();
    setNewLiabilityRepaymentFormMessage("");
    if (newLiabilityRepaymentSourceTypeInput) {
        newLiabilityRepaymentSourceTypeInput.value = "REPAYMENT_AMOUNT";
    }
    initializeNewRepaymentDateDefaults();
    renderNewRepaymentLiabilityOptions();
    updateNewLiabilityRepaymentSubmitButton(false);
}

function resetEditLiabilityRepaymentForm() {
    if (!editLiabilityRepaymentForm) {
        return;
    }

    editLiabilityRepaymentForm.reset();
    clearEditLiabilityRepaymentFieldHighlights();
    setEditLiabilityRepaymentFormMessage("");
    selectedEditRepaymentLiability = null;
    selectedEditRepayment = null;
    if (editLiabilityRepaymentSourceTypeInput) {
        editLiabilityRepaymentSourceTypeInput.value = "REPAYMENT_AMOUNT";
    }
    renderEditRepaymentLiabilityOptions();
    if (editLiabilityRepaymentSubmitButton) {
        editLiabilityRepaymentSubmitButton.disabled = true;
    }
}

async function openNewLiabilityRepaymentModal(trigger, liabilityId = "") {
    selectedNewRepaymentLiabilityId = liabilityId;
    resetNewLiabilityRepaymentForm();
    newLiabilityRepaymentModal.open({trigger});
}

async function openEditLiabilityRepaymentModal(liability, repayment, trigger) {
    selectedEditRepaymentLiability = liability;
    selectedEditRepayment = repayment;
    resetEditLiabilityRepaymentForm();
    selectedEditRepaymentLiability = liability;
    selectedEditRepayment = repayment;
    if (editLiabilityRepaymentDateInput) {
        editLiabilityRepaymentDateInput.value = repayment.repaymentDate ?? "";
    }
    if (editLiabilityRepaymentNoteInput) {
        editLiabilityRepaymentNoteInput.value = repayment.note ?? "";
    }
    if (editLiabilityRepaymentSourceTypeInput) {
        editLiabilityRepaymentSourceTypeInput.value = "REPAYMENT_AMOUNT";
    }
    renderEditRepaymentLiabilityOptions();
    editLiabilityRepaymentModal.open({trigger});
}

function setupNewLiabilityRepaymentForm() {
    if (!newLiabilityRepaymentForm) {
        return;
    }

    initializeNewRepaymentDateDefaults();
    renderNewRepaymentLiabilityOptions();

    newLiabilityRepaymentSelect?.addEventListener("change", () => {
        selectedNewRepaymentLiabilityId = newLiabilityRepaymentSelect.value;
        syncNewRepaymentSourceAmountFromSelection();
    });

    newLiabilityRepaymentSourceTypeInput?.addEventListener("change", () => {
        applyNewRepaymentSourceFieldLabel();
        syncNewRepaymentSourceAmountFromSelection();
    });

    newLiabilityRepaymentSourceAmountInput?.addEventListener("input", () => {
        updateNewRepaymentFinalAmountPreview();
    });

    newLiabilityRepaymentDateInput?.addEventListener("input", () => {
        updateNewRepaymentFinalAmountPreview();
    });

    newLiabilityRepaymentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearNewLiabilityRepaymentFieldHighlights();

        const liabilityId = newLiabilityRepaymentSelect?.value ?? "";
        const payload = newRepaymentPayloadFromForm();
        const validationError = validateNewRepaymentPayload(payload);
        if (validationError === "required") {
            applyNewLiabilityRepaymentFieldHighlights({
                liabilityId: !liabilityId,
                repaymentDate: !payload.repaymentDate,
                sourceType: !payload.sourceType,
                sourceAmount: !payload.sourceAmount
            });
            setNewLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "", "error");
            focusFirstNewLiabilityRepaymentHighlightedField();
            return;
        }
        if (validationError === "exceedsBalance") {
            highlightNewLiabilityField(newLiabilityRepaymentSourceAmountInput);
            setNewLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "", "error");
            focusFirstNewLiabilityRepaymentHighlightedField();
            return;
        }

        updateNewLiabilityRepaymentSubmitButton(true);
        setNewLiabilityRepaymentFormMessage("");

        try {
            await saveNewRepayment(liabilityId, payload);
            newLiabilityRepaymentModal.close();
            resetNewLiabilityRepaymentForm();
            await loadDashboard();
            showToast(liabilitiesMessages["liabilities.repayment.success"] ?? "", "success");
        } catch (error) {
            if (error.fieldErrors) {
                applyNewLiabilityRepaymentFieldHighlights(error.fieldErrors);
                focusFirstNewLiabilityRepaymentHighlightedField();
            }
            setNewLiabilityRepaymentFormMessage(error.message, "error");
            updateNewLiabilityRepaymentSubmitButton(false);
        }
    });

    Object.values(newLiabilityRepaymentFormControls).forEach((input) => {
        input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
        input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
    });

    if (newLiabilityRepaymentAction) {
        newLiabilityRepaymentAction.addEventListener("click", async (event) => {
            if (!shouldOpenModalFromClick(event)) {
                return;
            }

            event.preventDefault();

            try {
                await openNewLiabilityRepaymentModal(newLiabilityRepaymentAction);
            } catch (error) {
                showToast(error.message, "error");
                window.location.href = newLiabilityRepaymentAction.href;
            }
        });
    }
}

function setupEditLiabilityRepaymentForm() {
    if (!editLiabilityRepaymentForm) {
        return;
    }

    editLiabilityRepaymentSourceTypeInput?.addEventListener("change", () => {
        applyEditRepaymentSourceFieldLabel();
        syncEditRepaymentSourceAmountFromSelection();
    });

    editLiabilityRepaymentSourceAmountInput?.addEventListener("input", () => {
        updateEditRepaymentFinalAmountPreview();
    });

    editLiabilityRepaymentDateInput?.addEventListener("input", () => {
        updateEditRepaymentFinalAmountPreview();
    });

    editLiabilityRepaymentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearEditLiabilityRepaymentFieldHighlights();

        const payload = editRepaymentPayloadFromForm();
        const validationError = validateEditRepaymentPayload(payload);
        if (validationError === "required") {
            applyEditLiabilityRepaymentFieldHighlights({
                liabilityId: !selectedEditRepaymentLiability?.id,
                repaymentDate: !payload.repaymentDate,
                sourceType: !payload.sourceType,
                sourceAmount: !payload.sourceAmount
            });
            setEditLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "", "error");
            focusFirstEditLiabilityRepaymentHighlightedField();
            return;
        }
        if (validationError === "exceedsBalance") {
            highlightNewLiabilityField(editLiabilityRepaymentSourceAmountInput);
            setEditLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "", "error");
            focusFirstEditLiabilityRepaymentHighlightedField();
            return;
        }

        if (editLiabilityRepaymentSubmitButton) {
            editLiabilityRepaymentSubmitButton.disabled = true;
        }
        setEditLiabilityRepaymentFormMessage("");

        try {
            await saveEditedRepayment(payload);
            editLiabilityRepaymentModal.close();
            resetEditLiabilityRepaymentForm();
            await loadDashboard();
            showToast(liabilitiesMessages["liabilities.repayment.success"] ?? "", "success");
        } catch (error) {
            if (error.fieldErrors) {
                applyEditLiabilityRepaymentFieldHighlights(error.fieldErrors);
                focusFirstEditLiabilityRepaymentHighlightedField();
            }
            setEditLiabilityRepaymentFormMessage(error.message, "error");
            if (editLiabilityRepaymentSubmitButton) {
                editLiabilityRepaymentSubmitButton.disabled = false;
            }
        }
    });

    Object.values(editLiabilityRepaymentFormControls).forEach((input) => {
        input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
        input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
    });
}

function renderRepaymentList(liability, repayments) {
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
        editButton.addEventListener("click", async (event) => {
            if (!shouldOpenModalFromClick(event)) {
                return;
            }

            event.preventDefault();

            try {
                await openEditLiabilityRepaymentModal(liability, repayment, editButton);
            } catch (error) {
                showToast(error.message, "error");
                window.location.href = editButton.href;
            }
        });

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
    editButton.addEventListener("click", async (event) => {
        if (!shouldOpenModalFromClick(event)) {
            return;
        }

        event.preventDefault();

        try {
            await openEditLiabilityModal(liability, editButton);
        } catch (error) {
            showToast(error.message, "error");
            window.location.href = editButton.href;
        }
    });

    const repayButton = canRegisterRepayment(liability)
        ? document.createElement("a")
        : document.createElement("button");
    repayButton.className = "icon-button secondary";
    if (canRegisterRepayment(liability)) {
        repayButton.href = `/liabilities/repayments/new.html?liabilityId=${encodeURIComponent(liability.id)}`;
        repayButton.addEventListener("click", async (event) => {
            if (!shouldOpenModalFromClick(event)) {
                return;
            }

            event.preventDefault();

            try {
                await openNewLiabilityRepaymentModal(repayButton, liability.id);
            } catch (error) {
                showToast(error.message, "error");
                window.location.href = repayButton.href;
            }
        });
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

    panel.append(heading, renderRepaymentList(liability, liability.repayments));
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
    if (newLiabilityModalElement) {
        loadLiabilityFormMessages(nextLanguage).catch((error) => {
            console.warn(error);
        });
    }
    if (editLiabilityModalElement) {
        if (liabilityFormMessages && Object.keys(liabilityFormMessages).length > 0) {
            MoneySnapshotI18n.applyMessages(
                liabilityFormMessages,
                nextLanguage,
                editLiabilityModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
            );
            renderEditLiabilityBankOptions();
            lockEditLiabilityCurrentAmountWhenRepaymentsExist();
        }
    }
    if (newLiabilityRepaymentModalElement) {
        loadLiabilityRepaymentMessages(nextLanguage).catch((error) => {
            console.warn(error);
        });
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
    .then(setupNewLiabilityForm)
    .then(setupEditLiabilityForm)
    .then(setupNewLiabilityRepaymentForm)
    .then(setupEditLiabilityRepaymentForm)
    .then(loadDashboard)
    .then(showPendingNotification)
    .catch((error) => {
        renderSummary(null);
        renderEmpty(error.message);
        setListMessage(error.message, "error");
    });
