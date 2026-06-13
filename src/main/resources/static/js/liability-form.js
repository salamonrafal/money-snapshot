let liabilityFormMessages = {};
let cachedBanks = [];

const liabilityForm = document.getElementById("liability-form");
const liabilityFormMode = liabilityForm?.dataset.mode ?? "create";
const liabilityId = liabilityForm?.dataset.liabilityId ?? "";
const liabilityFormHeadingEyebrow = document.getElementById("liability-form-heading-eyebrow");
const liabilityFormHeadingTitle = document.getElementById("liability-form-heading-title");
const liabilityFormHeadingSubtitle = document.getElementById("liability-form-heading-subtitle");
const liabilityFormTitleEyebrow = document.getElementById("liability-form-title-eyebrow");
const liabilityBankSelect = document.getElementById("liability-bank");
const liabilityNameInput = document.getElementById("liability-name");
const liabilityFormMessageContainer = document.getElementById("liability-form-message-container");
const liabilityFormMessage = document.getElementById("liability-form-message");
const liabilityTypeSelect = document.getElementById("liability-type");
const liabilityCurrentAmountField = document.getElementById("liability-current-amount-field");
const liabilityInstallmentAmountField = document.getElementById("liability-installment-amount-field");
const liabilityCreditLimitField = document.getElementById("liability-credit-limit-field");
const liabilityCreditCardCurrentAmountField = document.getElementById("liability-credit-card-current-amount-field");
const liabilityCreditCardMinimumPaymentField = document.getElementById("liability-credit-card-minimum-payment-field");
const liabilityCurrentAmountInput = document.getElementById("liability-current-amount");
const liabilityCurrentAmountHint = document.getElementById("liability-current-amount-hint");
const liabilityInstallmentAmountInput = document.getElementById("liability-installment-amount");
const liabilityCreditLimitInput = document.getElementById("liability-credit-limit");
const liabilityCreditCardCurrentAmountInput = document.getElementById("liability-credit-card-current-amount");
const liabilityCreditCardMinimumPaymentInput = document.getElementById("liability-credit-card-minimum-payment");
const liabilityRepaymentStartDateInput = document.getElementById("liability-repayment-start-date");
const liabilityEndDateInput = document.getElementById("liability-end-date");
const liabilityFirstRepaymentDayInput = document.getElementById("liability-first-repayment-day");
const liabilityScheduleModeField = document.getElementById("liability-schedule-mode-field");
const liabilityScheduleModeSelect = document.getElementById("liability-schedule-mode");
const liabilityInstallmentCountField = document.getElementById("liability-installment-count-field");
const liabilityInstallmentCountInput = liabilityInstallmentCountField?.querySelector("input") ?? null;
const liabilityEndDateField = document.getElementById("liability-end-date-field");
const submitButton = document.getElementById("liability-form-submit") ?? liabilityForm?.querySelector("button[type='submit']") ?? null;
const cancelLink = liabilityForm?.querySelector("a.button.secondary") ?? null;
const returnTo = new URLSearchParams(window.location.search).get("returnTo") ?? "";
const LIABILITIES_NOTIFICATION_KEY = "money-snapshot-liabilities-notification";
let firstRepaymentDayManuallyEdited = false;
let loadedLiability = null;

function resolveRedirectUrl() {
    const safePath = MoneySnapshotUi.safeReturnToPath(returnTo);
    if (safePath) {
        return safePath;
    }

    return "/liabilities.html";
}

function syncCancelLink() {
    if (cancelLink) {
        cancelLink.href = resolveRedirectUrl();
    }
}

function persistLiabilitiesNotification(messageKey, type = "success") {
    try {
        window.sessionStorage.setItem(LIABILITIES_NOTIFICATION_KEY, JSON.stringify({
            messageKey,
            type
        }));
    } catch (error) {
        console.warn("Cannot save liabilities notification state", error);
    }
}

function applyModeCopy() {
    if (!liabilityFormMessages) {
        return;
    }

    const headingPrefix = liabilityFormMode === "edit" ? "liabilityForm.heading.edit" : "liabilityForm.heading";
    if (liabilityFormHeadingEyebrow) {
        liabilityFormHeadingEyebrow.textContent = liabilityFormMessages[`${headingPrefix}.eyebrow`] ?? liabilityFormHeadingEyebrow.textContent;
    }
    if (liabilityFormHeadingTitle) {
        liabilityFormHeadingTitle.textContent = liabilityFormMessages[`${headingPrefix}.title`] ?? liabilityFormHeadingTitle.textContent;
    }
    if (liabilityFormHeadingSubtitle) {
        liabilityFormHeadingSubtitle.textContent = liabilityFormMessages[`${headingPrefix}.subtitle`] ?? liabilityFormHeadingSubtitle.textContent;
    }
    if (liabilityFormTitleEyebrow) {
        liabilityFormTitleEyebrow.textContent = liabilityFormMessages[liabilityFormMode === "edit" ? "liabilityForm.form.titleEyebrowEdit" : "liabilityForm.form.titleEyebrow"] ?? liabilityFormTitleEyebrow.textContent;
    }
    if (submitButton) {
        submitButton.textContent = liabilityFormMessages[liabilityFormMode === "edit" ? "liabilityForm.form.update" : "liabilityForm.form.submit"] ?? submitButton.textContent;
    }
}

function setFormMessage(text, type = "") {
    if (!liabilityFormMessage) {
        return;
    }

    liabilityFormMessage.textContent = text;
    liabilityFormMessage.dataset.type = type;
    if (liabilityFormMessageContainer) {
        liabilityFormMessageContainer.dataset.type = type || "error";
        liabilityFormMessageContainer.hidden = !text;
        if (text && type === "error") {
            const bounds = liabilityFormMessageContainer.getBoundingClientRect();
            const outsideViewport = bounds.top < 0 || bounds.bottom > window.innerHeight;
            if (outsideViewport) {
                liabilityFormMessageContainer.scrollIntoView({behavior: "smooth", block: "start"});
            }
        }
    }
}

function formControls() {
    return {
        name: liabilityNameInput,
        bankName: liabilityBankSelect,
        liabilityTypeCode: liabilityTypeSelect,
        currentAmount: liabilityTypeSelect?.value === "CREDIT_CARD" ? liabilityCreditCardCurrentAmountInput : liabilityCurrentAmountInput,
        installmentAmount: liabilityInstallmentAmountInput,
        creditCardLimit: liabilityCreditLimitInput,
        creditCardMinimumPayment: liabilityCreditCardMinimumPaymentInput,
        endDate: liabilityEndDateInput,
        installmentCount: liabilityInstallmentCountInput,
        status: liabilityForm?.querySelector("select[name='status']") ?? null
    };
}

function clearFieldHighlights() {
    Object.values(formControls()).forEach((input) => input?.removeAttribute("aria-invalid"));
}

function highlightField(input) {
    input?.setAttribute("aria-invalid", "true");
}

function applyFieldHighlights(fieldErrors = {}) {
    const controls = formControls();
    Object.entries(fieldErrors).forEach(([fieldName, hasError]) => {
        if (!hasError) {
            return;
        }
        highlightField(controls[fieldName]);
    });
}

function focusFirstHighlightedField() {
    Object.values(formControls()).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
}

async function readErrorPayload(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

function renderBankOptions() {
    if (!liabilityBankSelect) {
        return;
    }

    const selectedValue = liabilityBankSelect.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = liabilityFormMessages["liabilityForm.form.bankPlaceholder"] ?? "";

    liabilityBankSelect.replaceChildren(
        placeholder,
        ...cachedBanks.map((bank) => {
            const option = document.createElement("option");
            option.value = bank.name;
            option.textContent = bank.name;
            return option;
        })
    );

    if (selectedValue) {
        liabilityBankSelect.value = selectedValue;
    }
}

async function loadBanks() {
    if (!liabilityBankSelect) {
        return;
    }

    const response = await fetch("/api/banks");
    if (!response.ok) {
        throw new Error(liabilityFormMessages["liabilityForm.error.loadBanks"] ?? "Cannot load banks");
    }

    cachedBanks = await response.json();
    renderBankOptions();
}

function setFieldVisibility(field, visible) {
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

function setFirstRepaymentDayValue(value, {markManualEdit = false} = {}) {
    if (!liabilityFirstRepaymentDayInput) {
        return;
    }

    liabilityFirstRepaymentDayInput.value = value ?? "";
    if (markManualEdit) {
        firstRepaymentDayManuallyEdited = true;
    }
}

function syncRepaymentDayWithStartDate(force = false) {
    if (!liabilityRepaymentStartDateInput || !liabilityFirstRepaymentDayInput) {
        return;
    }

    if (!force && firstRepaymentDayManuallyEdited) {
        return;
    }

    const repaymentDay = dayOfMonthFromIsoDate(liabilityRepaymentStartDateInput.value);
    if (repaymentDay) {
        setFirstRepaymentDayValue(repaymentDay);
    }
}

function initializeLiabilityDateDefaults() {
    if (liabilityFormMode === "edit") {
        return;
    }

    const today = todayIsoDate();

    if (liabilityRepaymentStartDateInput) {
        liabilityRepaymentStartDateInput.value = today;
    }

    if (liabilityEndDateInput) {
        liabilityEndDateInput.value = today;
    }

    syncRepaymentDayWithStartDate();
}

function lockCurrentAmountWhenRepaymentsExist() {
    if (!liabilityCurrentAmountInput) {
        return;
    }

    const hasRepayments = Array.isArray(loadedLiability?.repayments) && loadedLiability.repayments.length > 0;
    const isCreditCard = loadedLiability?.liabilityTypeCode === "CREDIT_CARD";
    const shouldLock = liabilityFormMode === "edit" && hasRepayments && !isCreditCard;

    liabilityCurrentAmountInput.readOnly = shouldLock;
    liabilityCurrentAmountInput.setAttribute("aria-readonly", shouldLock ? "true" : "false");

    if (liabilityCurrentAmountHint) {
        liabilityCurrentAmountHint.hidden = !shouldLock;
        liabilityCurrentAmountHint.textContent = shouldLock
            ? (liabilityFormMessages["liabilityForm.form.currentAmountLockedHint"] ?? liabilityCurrentAmountHint.textContent)
            : "";
    }
}

async function loadLiability() {
    if (liabilityFormMode !== "edit") {
        return;
    }

    if (!liabilityId) {
        throw new Error(liabilityFormMessages["liabilityForm.error.notFound"] ?? "Liability not found.");
    }

    const response = await fetch(`/api/liabilities/${encodeURIComponent(liabilityId)}`);
    if (response.status === 404) {
        throw new Error(liabilityFormMessages["liabilityForm.error.notFound"] ?? "Liability not found.");
    }

    if (!response.ok) {
        throw new Error(liabilityFormMessages["liabilityForm.error.loadLiability"] ?? "Cannot load liability.");
    }

    const liability = await response.json();
    loadedLiability = liability;
    if (liabilityNameInput) {
        liabilityNameInput.value = liability.name ?? "";
    }
    if (liabilityBankSelect) {
        liabilityBankSelect.value = liability.bankName ?? "";
    }
    if (liabilityTypeSelect) {
        liabilityTypeSelect.value = liability.liabilityTypeCode ?? liabilityTypeSelect.value;
    }
    if (liabilityCurrentAmountInput) {
        liabilityCurrentAmountInput.value = `${liability.currentAmount ?? 0}`;
    }
    if (liabilityInstallmentAmountInput) {
        liabilityInstallmentAmountInput.value = `${liability.installmentAmount ?? 0}`;
    }
    if (liabilityCreditLimitInput) {
        liabilityCreditLimitInput.value = `${liability.creditCardLimit ?? 0}`;
    }
    if (liabilityCreditCardCurrentAmountInput) {
        liabilityCreditCardCurrentAmountInput.value = `${liability.currentAmount ?? 0}`;
    }
    if (liabilityCreditCardMinimumPaymentInput) {
        liabilityCreditCardMinimumPaymentInput.value = `${liability.creditCardMinimumPayment ?? 0}`;
    }
    if (liabilityRepaymentStartDateInput) {
        liabilityRepaymentStartDateInput.value = liability.repaymentStartDate ?? "";
    }
    if (liabilityEndDateInput) {
        liabilityEndDateInput.value = liability.endDate ?? "";
    }
    if (liabilityInstallmentCountInput) {
        liabilityInstallmentCountInput.value = liability.installmentCount ?? "";
    }
    if (liabilityFirstRepaymentDayInput) {
        if (liability.firstRepaymentDay !== null && liability.firstRepaymentDay !== undefined) {
            setFirstRepaymentDayValue(liability.firstRepaymentDay, {markManualEdit: false});
            firstRepaymentDayManuallyEdited = false;
        } else {
            setFirstRepaymentDayValue("", {markManualEdit: false});
            firstRepaymentDayManuallyEdited = false;
            syncRepaymentDayWithStartDate(false);
        }
    }
    if (liabilityScheduleModeSelect) {
        liabilityScheduleModeSelect.value = liability.scheduleMode ?? liabilityScheduleModeSelect.value;
    }
    const noteInput = liabilityForm?.querySelector("textarea[name='note']");
    if (noteInput) {
        noteInput.value = liability.note ?? "";
    }
    const statusSelect = liabilityForm?.querySelector("select[name='status']");
    if (statusSelect) {
        statusSelect.value = liability.status ?? statusSelect.value;
    }

    updateLiabilityAmountFields();
    updateLiabilityScheduleFields();
    lockCurrentAmountWhenRepaymentsExist();
    updateSubmitButton(false);
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

function updateLiabilityAmountFields() {
    if (!liabilityTypeSelect) {
        return;
    }

    const isCreditCard = liabilityTypeSelect.value === "CREDIT_CARD";
    setFieldVisibility(liabilityCurrentAmountField, !isCreditCard);
    setFieldVisibility(liabilityInstallmentAmountField, !isCreditCard);
    setFieldVisibility(liabilityCreditLimitField, isCreditCard);
    setFieldVisibility(liabilityCreditCardCurrentAmountField, isCreditCard);
    setFieldVisibility(liabilityCreditCardMinimumPaymentField, isCreditCard);
}

function updateLiabilityScheduleFields() {
    if (!liabilityTypeSelect || !liabilityScheduleModeSelect) {
        return;
    }

    const type = liabilityTypeSelect.value;
    const scheduleMode = liabilityScheduleModeSelect.value;

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

    setFieldVisibility(liabilityScheduleModeField, showScheduleMode);
    setFieldVisibility(liabilityEndDateField, showEndDate);
    setFieldVisibility(liabilityInstallmentCountField, showInstallmentPlan);
    setFieldVisibility(document.getElementById("liability-first-repayment-day-field"), showRepaymentDay);
}

function requiredFieldValues(payload) {
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

    if (!payload.currentAmount || !payload.installmentAmount) {
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

function payloadFromForm() {
    const liabilityTypeCode = liabilityTypeSelect?.value ?? "";
    const scheduleMode = liabilityScheduleModeSelect?.value ?? "";
    const isCreditCard = liabilityTypeCode === "CREDIT_CARD";
    return {
        name: liabilityNameInput?.value.trim() ?? "",
        bankName: liabilityBankSelect?.value ?? "",
        liabilityTypeCode,
        scheduleMode: liabilityTypeCode === "OTHER" ? scheduleMode : null,
        currentAmount: isCreditCard
            ? normalizeDecimalInput(liabilityCreditCardCurrentAmountInput?.value)
            : normalizeDecimalInput(liabilityCurrentAmountInput?.value),
        installmentAmount: isCreditCard ? null : normalizeDecimalInput(liabilityInstallmentAmountInput?.value),
        creditCardLimit: isCreditCard ? normalizeDecimalInput(liabilityCreditLimitInput?.value) : null,
        creditCardMinimumPayment: isCreditCard ? normalizeDecimalInput(liabilityCreditCardMinimumPaymentInput?.value) : null,
        repaymentStartDate: liabilityRepaymentStartDateInput?.value || null,
        endDate: liabilityEndDateInput?.value || null,
        installmentCount: normalizeIntegerInput(liabilityInstallmentCountInput?.value, {min: 1}),
        firstRepaymentDay: normalizeIntegerInput(liabilityFirstRepaymentDayInput?.value, {min: 1, max: 31}),
        note: liabilityForm?.querySelector("textarea[name='note']")?.value.trim() ?? "",
        status: liabilityForm?.querySelector("select[name='status']")?.value ?? ""
    };
}

async function saveLiability(payload) {
    const isEdit = liabilityFormMode === "edit";
    const response = await fetch(isEdit ? `/api/liabilities/${encodeURIComponent(liabilityId)}` : "/api/liabilities", {
        method: isEdit ? "PUT" : "POST",
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
        throw new Error(errorPayload?.message ?? liabilityFormMessages[isEdit ? "liabilityForm.error.update" : "liabilityForm.error.required"] ?? "Validation failed");
    }

    if (response.status === 404) {
        throw new Error(liabilityFormMessages["liabilityForm.error.notFound"] ?? "Liability not found");
    }

    if (!response.ok) {
        throw new Error(liabilityFormMessages[isEdit ? "liabilityForm.error.update" : "liabilityForm.error.create"] ?? "Cannot save liability");
    }

    return response.json();
}

function updateSubmitButton(disabled) {
    if (submitButton) {
        submitButton.disabled = disabled;
    }
}

function requiredFieldErrors(payload) {
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

function setupLiabilityForm() {
    if (!liabilityForm || !liabilityTypeSelect || !liabilityScheduleModeSelect) {
        return;
    }

    initializeLiabilityDateDefaults();
    if (liabilityFormMode === "edit") {
        updateSubmitButton(true);
    }
    updateLiabilityAmountFields();
    updateLiabilityScheduleFields();

    liabilityTypeSelect.addEventListener("change", () => {
        updateLiabilityAmountFields();
        updateLiabilityScheduleFields();
    });
    liabilityScheduleModeSelect.addEventListener("change", updateLiabilityScheduleFields);
    liabilityRepaymentStartDateInput?.addEventListener("change", () => syncRepaymentDayWithStartDate(false));
    liabilityFirstRepaymentDayInput?.addEventListener("input", () => {
        firstRepaymentDayManuallyEdited = true;
    });
    liabilityFirstRepaymentDayInput?.addEventListener("change", () => {
        firstRepaymentDayManuallyEdited = true;
    });

    liabilityForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFieldHighlights();

        const payload = payloadFromForm();
        if (!requiredFieldValues(payload)) {
            applyFieldHighlights(requiredFieldErrors(payload));
            setFormMessage(liabilityFormMessages["liabilityForm.error.required"] ?? "", "error");
            focusFirstHighlightedField();
            return;
        }

        updateSubmitButton(true);
        setFormMessage("");

        try {
            await saveLiability(payload);
            persistLiabilitiesNotification("liabilities.form.success", "success");
            window.location.href = resolveRedirectUrl();
        } catch (error) {
            if (error.fieldErrors) {
                applyFieldHighlights(error.fieldErrors);
                focusFirstHighlightedField();
            }
            setFormMessage(error.message, "error");
            updateSubmitButton(false);
            if (!error.fieldErrors) {
                liabilityNameInput?.focus();
            }
        }
    });

    Object.values(formControls()).forEach((input) => {
        input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
        input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
    });
}

MoneySnapshotI18n.init({
    endpoint: "/api/liability-form/messages",
    onLanguageChange: ({messages}) => {
        liabilityFormMessages = messages;
        document.title = `${liabilityFormMessages[liabilityFormMode === "edit" ? "liabilityForm.heading.edit.title" : "liabilityForm.heading.title"]} | ${liabilityFormMessages["app.name"]}`;
        applyModeCopy();
        renderBankOptions();
        updateLiabilityAmountFields();
        updateLiabilityScheduleFields();
        lockCurrentAmountWhenRepaymentsExist();
    }
})
    .then(() => MoneySnapshotUi.loadUserSettings())
    .then(loadBanks)
    .then(loadLiability)
    .then(syncCancelLink)
    .catch((error) => {
        setFormMessage(error.message, "error");
        updateSubmitButton(true);
    });

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupLiabilityForm, {once: true});
} else {
    setupLiabilityForm();
}
