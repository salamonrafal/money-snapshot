let liabilityRepaymentMessages = {};
let userSettings = null;
let cachedLiabilities = [];
let cachedEditRepayment = null;
let cachedEditLiability = null;
let selectedLiabilityId = new URLSearchParams(window.location.search).get("liabilityId") ?? "";

const liabilityRepaymentForm = document.getElementById("liability-repayment-form");
const liabilityRepaymentFormMode = liabilityRepaymentForm?.dataset.mode ?? "create";
const liabilityRepaymentId = liabilityRepaymentForm?.dataset.repaymentId ?? "";
const liabilityRepaymentSelect = document.getElementById("liability-repayment-liability");
const liabilityRepaymentDateInput = document.getElementById("liability-repayment-date");
const liabilityRepaymentSourceTypeInput = document.getElementById("liability-repayment-source-type");
const liabilityRepaymentSourceAmountInput = document.getElementById("liability-repayment-source-amount");
const liabilityRepaymentFinalAmountInput = document.getElementById("liability-repayment-final-amount");
const liabilityRepaymentSourceLabel = document.getElementById("liability-repayment-source-label");
const liabilityRepaymentNoteInput = document.getElementById("liability-repayment-note");
const liabilityRepaymentHeadingEyebrow = document.querySelector(".page-heading .eyebrow");
const liabilityRepaymentHeadingTitle = document.querySelector(".page-heading h1");
const liabilityRepaymentHeadingSubtitle = document.querySelector(".page-heading p");
const liabilityRepaymentFormTitle = liabilityRepaymentForm?.querySelector("h2") ?? null;
const liabilityRepaymentFormMessageContainer = document.getElementById("liability-repayment-form-message-container");
const liabilityRepaymentFormMessage = document.getElementById("liability-repayment-form-message");
const submitButton = liabilityRepaymentForm?.querySelector("button[type='submit']") ?? null;
const cancelLink = liabilityRepaymentForm?.querySelector("a.button.secondary") ?? null;
const LIABILITIES_NOTIFICATION_KEY = "money-snapshot-liabilities-notification";
const repaymentFormControls = {
    liabilityId: liabilityRepaymentSelect,
    repaymentDate: liabilityRepaymentDateInput,
    sourceType: liabilityRepaymentSourceTypeInput,
    sourceAmount: liabilityRepaymentSourceAmountInput
};

function isEditMode() {
    return liabilityRepaymentFormMode === "edit";
}

function setFormMessage(text, type = "") {
    if (!liabilityRepaymentFormMessage) {
        return;
    }

    liabilityRepaymentFormMessage.textContent = text;
    liabilityRepaymentFormMessage.dataset.type = type;
    if (liabilityRepaymentFormMessageContainer) {
        liabilityRepaymentFormMessageContainer.dataset.type = type || "error";
        liabilityRepaymentFormMessageContainer.hidden = !text;
    }
}

function clearFieldHighlights() {
    Object.values(repaymentFormControls).forEach((input) => input?.removeAttribute("aria-invalid"));
}

function highlightField(input) {
    input?.setAttribute("aria-invalid", "true");
}

function focusFirstHighlightedField() {
    Object.values(repaymentFormControls).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
}

function applyFieldHighlights(fieldErrors = {}) {
    if (fieldErrors.liabilityId) {
        highlightField(liabilityRepaymentSelect);
    }
    if (fieldErrors.repaymentDate) {
        highlightField(liabilityRepaymentDateInput);
    }
    if (fieldErrors.sourceType) {
        highlightField(liabilityRepaymentSourceTypeInput);
    }
    if (fieldErrors.sourceAmount) {
        highlightField(liabilityRepaymentSourceAmountInput);
    }
}

async function readErrorPayload(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
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

function resolveRedirectUrl() {
    const safePath = MoneySnapshotUi.safeReturnToPath(new URLSearchParams(window.location.search).get("returnTo") ?? "");
    return safePath || "/liabilities.html";
}

function syncCancelLink() {
    if (cancelLink) {
        cancelLink.href = resolveRedirectUrl();
    }
}

function todayIsoDate() {
    return MoneySnapshotUi.localIsoDate();
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

function formatMoney(value) {
    return MoneySnapshotUi.formatMoneyValue(value ?? 0, userSettings);
}

function sourceType() {
    return liabilityRepaymentSourceTypeInput?.value === "CURRENT_AMOUNT" ? "CURRENT_AMOUNT" : "REPAYMENT_AMOUNT";
}

function selectedLiability() {
    return cachedLiabilities.find((liability) => liability.id === liabilityRepaymentSelect?.value) ?? null;
}

function selectedLiabilityCurrentAmount() {
    return selectedLiability()?.currentAmount ?? 0;
}

function isEditContextReady() {
    return !isEditMode() || Boolean(cachedEditRepayment && cachedEditLiability);
}

function compareRepaymentsAscending(left, right) {
    const repaymentDateDiff = `${left.repaymentDate ?? ""}`.localeCompare(`${right.repaymentDate ?? ""}`);
    if (repaymentDateDiff !== 0) {
        return repaymentDateDiff;
    }

    return `${left.createdAt ?? ""}`.localeCompare(`${right.createdAt ?? ""}`);
}

function repaymentDateForSelection(repayment) {
    if (isEditMode() && repayment?.id === cachedEditRepayment?.id) {
        return liabilityRepaymentDateInput?.value || cachedEditRepayment.repaymentDate || "";
    }

    return repayment?.repaymentDate ?? "";
}

function compareRepaymentsForSelection(left, right) {
    const repaymentDateDiff = repaymentDateForSelection(left).localeCompare(repaymentDateForSelection(right));
    if (repaymentDateDiff !== 0) {
        return repaymentDateDiff;
    }

    return `${left.createdAt ?? ""}`.localeCompare(`${right.createdAt ?? ""}`);
}

function repaymentReplayStartingBalance(liability, repayments) {
    if (liability?.liabilityTypeCode !== "CREDIT_CARD") {
        return Number(liability?.originalAmount ?? 0);
    }

    const firstRepayment = repayments[0];
    if (!firstRepayment) {
        return Number(liability?.currentAmount ?? 0);
    }

    return Number(firstRepayment.currentAmount ?? 0) + Number(firstRepayment.amount ?? 0);
}

function baseCurrentAmountForSelection() {
    if (!isEditMode() || !cachedEditLiability || !cachedEditRepayment) {
        return Number(selectedLiabilityCurrentAmount() ?? 0);
    }

    const savedRepayments = [...(cachedEditLiability.repayments ?? [])].sort(compareRepaymentsAscending);
    const replayRepayments = [...(cachedEditLiability.repayments ?? [])].sort(compareRepaymentsForSelection);
    let currentAmount = repaymentReplayStartingBalance(cachedEditLiability, savedRepayments);

    for (const repayment of replayRepayments) {
        if (repayment.id === cachedEditRepayment.id) {
            break;
        }

        currentAmount = Number(repayment.currentAmount ?? currentAmount);
    }

    return currentAmount;
}

function applyModeCopy() {
    if (!liabilityRepaymentMessages) {
        return;
    }

    const headingPrefix = isEditMode() ? "liabilityRepayment.heading.edit" : "liabilityRepayment.heading";
    if (liabilityRepaymentHeadingEyebrow) {
        liabilityRepaymentHeadingEyebrow.textContent = liabilityRepaymentMessages[`${headingPrefix}.eyebrow`] ?? liabilityRepaymentHeadingEyebrow.textContent;
    }
    if (liabilityRepaymentHeadingTitle) {
        liabilityRepaymentHeadingTitle.textContent = liabilityRepaymentMessages[`${headingPrefix}.title`] ?? liabilityRepaymentHeadingTitle.textContent;
    }
    if (liabilityRepaymentHeadingSubtitle) {
        liabilityRepaymentHeadingSubtitle.textContent = liabilityRepaymentMessages[`${headingPrefix}.subtitle`] ?? liabilityRepaymentHeadingSubtitle.textContent;
    }
    if (liabilityRepaymentFormTitle) {
        liabilityRepaymentFormTitle.textContent = liabilityRepaymentMessages["liabilityRepayment.form.title"] ?? liabilityRepaymentFormTitle.textContent;
    }
    if (submitButton) {
        submitButton.textContent = liabilityRepaymentMessages[isEditMode() ? "liabilityRepayment.form.update" : "liabilityRepayment.form.submit"] ?? submitButton.textContent;
    }
}

function applySourceFieldLabel() {
    if (!liabilityRepaymentSourceLabel) {
        return;
    }

    liabilityRepaymentSourceLabel.textContent = sourceType() === "CURRENT_AMOUNT"
        ? (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountCurrentAmount"] ?? "Aktualne saldo")
        : (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountRepaymentAmount"] ?? "Kwota spłaty");
}

function updateFinalAmountPreview() {
    if (!liabilityRepaymentFinalAmountInput) {
        return;
    }

    const rawValue = normalizeDecimalInput(liabilityRepaymentSourceAmountInput?.value);
    if (rawValue === null) {
        liabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    const sourceValue = Number(rawValue);
    if (!Number.isFinite(sourceValue)) {
        liabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    if (sourceType() === "CURRENT_AMOUNT") {
        liabilityRepaymentFinalAmountInput.value = formatMoney(sourceValue);
        return;
    }

    liabilityRepaymentFinalAmountInput.value = formatMoney(baseCurrentAmountForSelection() - sourceValue);
}

function syncSourceAmountFromSelection() {
    if (!liabilityRepaymentSourceAmountInput) {
        return;
    }

    if (isEditMode() && cachedEditRepayment) {
        liabilityRepaymentSourceAmountInput.value = sourceType() === "CURRENT_AMOUNT"
            ? `${cachedEditRepayment.currentAmount ?? 0}`
            : `${cachedEditRepayment.amount ?? 0}`;
        updateFinalAmountPreview();
        return;
    }

    const currentAmount = Number(selectedLiabilityCurrentAmount() ?? 0);
    liabilityRepaymentSourceAmountInput.value = sourceType() === "CURRENT_AMOUNT" ? `${currentAmount}` : "0";
    updateFinalAmountPreview();
}

function setInputsEnabled(hasLiabilities) {
    if (liabilityRepaymentSourceTypeInput) {
        liabilityRepaymentSourceTypeInput.disabled = !hasLiabilities;
    }
    if (liabilityRepaymentSourceAmountInput) {
        liabilityRepaymentSourceAmountInput.disabled = !hasLiabilities;
    }
    if (liabilityRepaymentFinalAmountInput) {
        liabilityRepaymentFinalAmountInput.disabled = !hasLiabilities;
    }
}

function renderLiabilityOptions() {
    if (!liabilityRepaymentSelect) {
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = liabilityRepaymentMessages["liabilityRepayment.form.liabilityPlaceholder"] ?? "";

    liabilityRepaymentSelect.replaceChildren(
        placeholder,
        ...cachedLiabilities.map((liability) => {
            const option = document.createElement("option");
            option.value = liability.id;
            option.textContent = `${liability.name} · ${liability.bankName} · ${formatMoney(liability.currentAmount)}`;
            return option;
        })
    );

    if (selectedLiabilityId) {
        liabilityRepaymentSelect.value = selectedLiabilityId;
    }

    const hasLiabilities = cachedLiabilities.length > 0;
    liabilityRepaymentSelect.disabled = !hasLiabilities || isEditMode();
    setInputsEnabled(hasLiabilities && isEditContextReady());
    if (submitButton) {
        submitButton.disabled = !hasLiabilities || !isEditContextReady();
    }

    if (!hasLiabilities) {
        setFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.noLiabilities"] ?? "", "error");
    } else if (liabilityRepaymentFormMessage?.dataset.type === "error") {
        setFormMessage("", "");
    }

    applySourceFieldLabel();
    syncSourceAmountFromSelection();
}

async function loadLiabilities() {
    const response = await fetch("/api/liabilities");
    if (!response.ok) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.loadLiabilities"] ?? "Cannot load liabilities.");
    }

    const dashboard = await response.json();
    cachedLiabilities = dashboard.liabilities ?? [];
    renderLiabilityOptions();
}

async function loadEditContext() {
    if (!isEditMode()) {
        return;
    }

    if (!liabilityRepaymentId) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.repaymentNotFound"] ?? "Repayment not found.");
    }

    const repaymentResponse = await fetch(`/api/liabilities/repayments/${encodeURIComponent(liabilityRepaymentId)}`);
    if (repaymentResponse.status === 404) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.repaymentNotFound"] ?? "Repayment not found.");
    }

    if (!repaymentResponse.ok) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.loadRepayment"] ?? "Cannot load repayment.");
    }

    cachedEditRepayment = await repaymentResponse.json();
    selectedLiabilityId = cachedEditRepayment.liabilityId ?? "";

    const liabilityResponse = await fetch(`/api/liabilities/${encodeURIComponent(selectedLiabilityId)}`);
    if (liabilityResponse.status === 404) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.repaymentNotFound"] ?? "Repayment not found.");
    }

    if (!liabilityResponse.ok) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.loadLiability"] ?? "Cannot load liability.");
    }

    cachedEditLiability = await liabilityResponse.json();

    if (liabilityRepaymentDateInput) {
        liabilityRepaymentDateInput.value = cachedEditRepayment.repaymentDate ?? "";
    }
    if (liabilityRepaymentSourceTypeInput) {
        liabilityRepaymentSourceTypeInput.value = "REPAYMENT_AMOUNT";
    }
    if (liabilityRepaymentNoteInput) {
        liabilityRepaymentNoteInput.value = cachedEditRepayment.note ?? "";
    }

    renderLiabilityOptions();
}

function initializeDateDefaults() {
    if (isEditMode()) {
        return;
    }

    if (liabilityRepaymentDateInput && !liabilityRepaymentDateInput.value) {
        liabilityRepaymentDateInput.value = todayIsoDate();
    }
}

function payloadFromForm() {
    return {
        repaymentDate: liabilityRepaymentDateInput?.value || null,
        sourceType: sourceType(),
        sourceAmount: normalizeDecimalInput(liabilityRepaymentSourceAmountInput?.value),
        note: liabilityRepaymentNoteInput?.value.trim() ?? ""
    };
}

function validatePayload(payload) {
    if (!liabilityRepaymentSelect?.value || !payload.repaymentDate || !payload.sourceType || !payload.sourceAmount) {
        return "required";
    }

    const selected = selectedLiability();
    if (!selected) {
        return "required";
    }

    const sourceValue = Number(payload.sourceAmount);
    const baseValue = baseCurrentAmountForSelection();
    if (!Number.isFinite(sourceValue) || sourceValue < 0 || sourceValue > baseValue) {
        return "exceedsBalance";
    }

    return "";
}

async function saveRepayment(liabilityId, payload) {
    const isEdit = isEditMode();
    const response = await fetch(isEdit
        ? `/api/liabilities/repayments/${encodeURIComponent(liabilityRepaymentId)}`
        : `/api/liabilities/${encodeURIComponent(liabilityId)}/repayments`, {
        method: isEdit ? "PUT" : "POST",
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
        throw new Error(liabilityRepaymentMessages[isEdit ? "liabilityRepayment.error.update" : "liabilityRepayment.error.create"] ?? "Cannot save repayment.");
    }

    return response.json();
}

liabilityRepaymentSelect?.addEventListener("change", () => {
    selectedLiabilityId = liabilityRepaymentSelect.value;
    syncSourceAmountFromSelection();
});

liabilityRepaymentSourceTypeInput?.addEventListener("change", () => {
    applySourceFieldLabel();
    syncSourceAmountFromSelection();
});

liabilityRepaymentSourceAmountInput?.addEventListener("input", () => {
    updateFinalAmountPreview();
});

liabilityRepaymentDateInput?.addEventListener("input", () => {
    updateFinalAmountPreview();
});

liabilityRepaymentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldHighlights();

    const liabilityId = liabilityRepaymentSelect?.value ?? "";
    const payload = payloadFromForm();
    const validationError = validatePayload(payload);
    if (validationError === "required") {
        applyFieldHighlights({
            liabilityId: !liabilityId,
            repaymentDate: !payload.repaymentDate,
            sourceType: !payload.sourceType,
            sourceAmount: !payload.sourceAmount
        });
        setFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "", "error");
        focusFirstHighlightedField();
        return;
    }
    if (validationError === "exceedsBalance") {
        highlightField(liabilityRepaymentSourceAmountInput);
        setFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "", "error");
        focusFirstHighlightedField();
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
    }
    setFormMessage("");

    try {
        await saveRepayment(liabilityId, payload);
        persistLiabilitiesNotification("liabilities.repayment.success", "success");
        window.location.href = resolveRedirectUrl();
    } catch (error) {
        if (error.fieldErrors) {
            applyFieldHighlights(error.fieldErrors);
            focusFirstHighlightedField();
        }
        setFormMessage(error.message, "error");
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
});

Object.values(repaymentFormControls).forEach((input) => {
    input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
    input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
});

MoneySnapshotI18n.init({
    endpoint: "/api/liability-repayment/messages",
    onLanguageChange: ({messages}) => {
        liabilityRepaymentMessages = messages;
        const headingPrefix = isEditMode() ? "liabilityRepayment.heading.edit" : "liabilityRepayment.heading";
        document.title = `${liabilityRepaymentMessages[`${headingPrefix}.title`] ?? liabilityRepaymentMessages["liabilityRepayment.heading.title"] ?? ""} | ${liabilityRepaymentMessages["app.name"]}`;
        applyModeCopy();
        applySourceFieldLabel();
        updateFinalAmountPreview();
        renderLiabilityOptions();
    }
})
    .then(() => MoneySnapshotUi.loadUserSettings())
    .then((settings) => {
        userSettings = settings;
    })
    .then(() => {
        initializeDateDefaults();
        syncCancelLink();
        return loadLiabilities();
    })
    .then(() => loadEditContext())
    .catch((error) => {
        setFormMessage(error.message, "error");
    });
