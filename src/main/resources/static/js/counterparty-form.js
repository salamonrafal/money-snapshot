const counterpartyId = document.body.dataset.counterpartyId || null;
const counterpartyForm = document.querySelector("#counterparty-form");
const counterpartyPageTitle = document.querySelector("#counterparty-form-page-title");
const counterpartyPageSubtitle = document.querySelector("#counterparty-form-page-subtitle");
const counterpartyFormMessageContainer = document.querySelector("#counterparty-form-message-container");
const counterpartyFormMessage = document.querySelector("#counterparty-form-message");
const counterpartyNameInput = document.querySelector("#counterparty-name");
const counterpartyBankAccountNumberInput = document.querySelector("#counterparty-bank-account-number");
const counterpartyBankAccountBankInfo = document.querySelector("#counterparty-bank-account-bank-info");
const counterpartyAddressInput = document.querySelector("#counterparty-address");
const counterpartyNoteInput = document.querySelector("#counterparty-note");
const saveCounterpartyButton = document.querySelector("#save-counterparty");
const COUNTERPARTIES_NOTIFICATION_KEY = "money-snapshot-counterparties-notification";

let counterpartyFormMessages = {};
const counterpartyFormControls = [
    counterpartyNameInput,
    counterpartyBankAccountNumberInput
].filter(Boolean);

function handleCounterpartyFormLanguageChange(nextMessages) {
    counterpartyFormMessages = nextMessages;
    const title = counterpartyId
        ? counterpartyFormMessages["counterpartyForm.heading.edit.title"] ?? ""
        : counterpartyFormMessages["counterpartyForm.heading.title"] ?? "";
    const subtitle = counterpartyId
        ? counterpartyFormMessages["counterpartyForm.heading.edit.subtitle"] ?? ""
        : counterpartyFormMessages["counterpartyForm.heading.subtitle"] ?? "";
    document.title = `${title} | ${counterpartyFormMessages["app.name"]}`;
    counterpartyPageTitle.textContent = title;
    counterpartyPageSubtitle.textContent = subtitle;
}

function setCounterpartyFormMessage(text, type = "error", baseMessage = text) {
    if (!counterpartyFormMessageContainer || !counterpartyFormMessage) {
        return;
    }

    counterpartyFormMessage.textContent = text;
    counterpartyFormMessage.dataset.type = type;
    counterpartyFormMessageContainer.dataset.type = type;
    counterpartyFormMessageContainer.dataset.baseMessage = baseMessage;
    counterpartyFormMessageContainer.hidden = !text;
}

function clearCounterpartyFormMessage() {
    setCounterpartyFormMessage("", "error");
}

function setCounterpartyBankInfo(text) {
    if (!counterpartyBankAccountBankInfo) {
        return;
    }

    counterpartyBankAccountBankInfo.textContent = text;
    counterpartyBankAccountBankInfo.classList.toggle("is-empty", !text);
}

function persistCounterpartiesNotification(messageKey, type = "success") {
    try {
        window.sessionStorage.setItem(COUNTERPARTIES_NOTIFICATION_KEY, JSON.stringify({
            messageKey,
            type
        }));
    } catch (error) {
        console.warn("Cannot save counterparties notification state", error);
    }
}

function clearCounterpartyFieldHighlights() {
    counterpartyFormControls.forEach((input) => input.removeAttribute("aria-invalid"));
}

function highlightCounterpartyField(input) {
    input?.setAttribute("aria-invalid", "true");
}

function focusFirstHighlightedCounterpartyField() {
    counterpartyFormControls.find((input) => input.getAttribute("aria-invalid") === "true")?.focus();
}

function counterpartyFieldLabel(input) {
    if (input === counterpartyNameInput) {
        return counterpartyFormMessages["counterpartyForm.form.name"] ?? "";
    }

    if (input === counterpartyBankAccountNumberInput) {
        return counterpartyFormMessages["counterpartyForm.form.bankAccountNumber"] ?? "";
    }

    return "";
}

function buildCounterpartyValidationSummary(baseMessage) {
    const invalidFields = counterpartyFormControls
        .filter((input) => input.getAttribute("aria-invalid") === "true")
        .map(counterpartyFieldLabel)
        .filter(Boolean);

    if (invalidFields.length === 0) {
        return baseMessage;
    }

    return `${baseMessage} ${invalidFields.join(", ")}.`;
}

function normalizeCounterpartyBankAccountNumber(value) {
    return MoneySnapshotUi.normalizeBankAccountNumber(value);
}

function updateCounterpartyBankInfo() {
    const rawValue = counterpartyBankAccountNumberInput?.value ?? "";
    if (!rawValue.trim() || !isValidCounterpartyBankAccountNumber(rawValue)) {
        setCounterpartyBankInfo("");
        return;
    }

    const label = counterpartyFormMessages["counterpartyForm.form.bankNameHint"] ?? "";
    const bankName = MoneySnapshotUi.resolvePolishBankNameFromAccountNumber(rawValue)
        || (counterpartyFormMessages["counterpartyForm.form.bankNameUnknown"] ?? "");

    setCounterpartyBankInfo(`${label}: ${bankName}`);
}

function isValidCounterpartyBankAccountNumber(value) {
    const normalized = normalizeCounterpartyBankAccountNumber(value);
    if (!normalized) {
        return false;
    }

    let iban = normalized;
    if (/^\d{26}$/.test(normalized)) {
        iban = `PL${normalized}`;
    } else if (!/^PL\d{26}$/.test(normalized)) {
        return false;
    }

    const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
    let remainder = 0;

    for (const character of rearranged) {
        if (/\d/.test(character)) {
            remainder = (remainder * 10 + Number(character)) % 97;
            continue;
        }

        if (!/[A-Z]/.test(character)) {
            return false;
        }

        const mapped = String(character.charCodeAt(0) - 55);
        for (const digit of mapped) {
            remainder = (remainder * 10 + Number(digit)) % 97;
        }
    }

    return remainder === 1;
}

function validateCounterpartyForm() {
    if (!counterpartyNameInput.value.trim()) {
        highlightCounterpartyField(counterpartyNameInput);
    }

    if (!counterpartyBankAccountNumberInput.value.trim()) {
        highlightCounterpartyField(counterpartyBankAccountNumberInput);
    } else if (!isValidCounterpartyBankAccountNumber(counterpartyBankAccountNumberInput.value)) {
        highlightCounterpartyField(counterpartyBankAccountNumberInput);
        return counterpartyFormMessages["counterpartyForm.form.invalidBankAccountNumber"];
    }

    return counterpartyFormControls.every((input) => input.getAttribute("aria-invalid") !== "true")
        ? ""
        : counterpartyFormMessages["counterpartyForm.form.required"];
}

function buildCounterpartyPayload() {
    return {
        name: counterpartyNameInput.value.trim(),
        bankAccountNumber: normalizeCounterpartyBankAccountNumber(counterpartyBankAccountNumberInput.value),
        address: counterpartyAddressInput.value.trim() || null,
        note: counterpartyNoteInput.value.trim() || null
    };
}

function fillCounterpartyForm(counterparty) {
    counterpartyNameInput.value = counterparty.name ?? "";
    counterpartyBankAccountNumberInput.value = counterparty.bankAccountNumber ?? "";
    counterpartyAddressInput.value = counterparty.address ?? "";
    counterpartyNoteInput.value = counterparty.note ?? "";
    updateCounterpartyBankInfo();
}

async function readCounterpartyErrorPayload(response) {
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

function applyCounterpartyServerFieldHighlights(fieldErrors = {}) {
    if (fieldErrors.name) {
        highlightCounterpartyField(counterpartyNameInput);
    }
    if (fieldErrors.bankAccountNumber) {
        highlightCounterpartyField(counterpartyBankAccountNumberInput);
    }
}

function resolveCounterpartyValidationMessage(fieldErrors = {}) {
    if (fieldErrors.bankAccountNumber === "ValidBankAccountNumber") {
        return counterpartyFormMessages["counterpartyForm.form.invalidBankAccountNumber"];
    }

    return counterpartyFormMessages["counterpartyForm.form.required"];
}

async function loadCounterparty() {
    if (!counterpartyId) {
        return;
    }

    const response = await fetch(`/api/counterparties/${encodeURIComponent(counterpartyId)}`);
    if (response.status === 404) {
        throw new Error(counterpartyFormMessages["counterpartyForm.error.notFound"]);
    }
    if (!response.ok) {
        throw new Error(counterpartyFormMessages["counterpartyForm.error.loadCounterparty"]);
    }

    fillCounterpartyForm(await response.json());
}

async function saveCounterparty(payload) {
    const response = await fetch(counterpartyId ? `/api/counterparties/${encodeURIComponent(counterpartyId)}` : "/api/counterparties", {
        method: counterpartyId ? "PUT" : "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readCounterpartyErrorPayload(response);

    if (response.status === 409) {
        throw new Error(counterpartyFormMessages["counterpartyForm.error.duplicate"]);
    }
    if (response.status === 404) {
        throw new Error(counterpartyFormMessages["counterpartyForm.error.notFound"]);
    }
    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(resolveCounterpartyValidationMessage(errorPayload.fieldErrors));
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        throw new Error(counterpartyFormMessages["counterpartyForm.form.required"]);
    }
    if (!response.ok) {
        throw new Error(counterpartyId
            ? counterpartyFormMessages["counterpartyForm.error.update"]
            : counterpartyFormMessages["counterpartyForm.error.create"]);
    }
}

counterpartyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearCounterpartyFormMessage();
    clearCounterpartyFieldHighlights();
    const validationMessage = validateCounterpartyForm();
    if (!counterpartyForm.reportValidity() || validationMessage) {
            setCounterpartyFormMessage(
                buildCounterpartyValidationSummary(validationMessage || counterpartyFormMessages["counterpartyForm.form.required"]),
                "error",
                validationMessage || counterpartyFormMessages["counterpartyForm.form.required"]
            );
            focusFirstHighlightedCounterpartyField();
            return;
        }

    saveCounterpartyButton.disabled = true;
    try {
        await saveCounterparty(buildCounterpartyPayload());
        persistCounterpartiesNotification("counterparties.form.success", "success");
        window.location.href = "/counterparties.html";
    } catch (error) {
        if (error.fieldErrors) {
            applyCounterpartyServerFieldHighlights(error.fieldErrors);
            setCounterpartyFormMessage(buildCounterpartyValidationSummary(error.message), "error", error.message);
            focusFirstHighlightedCounterpartyField();
        } else if (error.message === counterpartyFormMessages["counterpartyForm.error.duplicate"]) {
            highlightCounterpartyField(counterpartyNameInput);
            setCounterpartyFormMessage(buildCounterpartyValidationSummary(error.message), "error", error.message);
            focusFirstHighlightedCounterpartyField();
        } else {
            setCounterpartyFormMessage(error.message, "error");
        }
        saveCounterpartyButton.disabled = false;
    }
});

[
    counterpartyNameInput,
    counterpartyBankAccountNumberInput
].forEach((input) => {
    input?.addEventListener("input", () => {
        input.removeAttribute("aria-invalid");
        if (input === counterpartyBankAccountNumberInput) {
            setCounterpartyBankInfo("");
        }
        if (counterpartyFormMessageContainer && !counterpartyFormMessageContainer.hidden) {
            setCounterpartyFormMessage(
                buildCounterpartyValidationSummary(counterpartyFormMessageContainer.dataset.baseMessage || counterpartyFormMessage.textContent),
                counterpartyFormMessageContainer.dataset.type || "error",
                counterpartyFormMessageContainer.dataset.baseMessage || counterpartyFormMessage.textContent
            );
        }
    });
});

counterpartyBankAccountNumberInput?.addEventListener("blur", () => {
    if (counterpartyBankAccountNumberInput.value.trim()) {
        counterpartyBankAccountNumberInput.value = normalizeCounterpartyBankAccountNumber(counterpartyBankAccountNumberInput.value);
    }
    updateCounterpartyBankInfo();
});

MoneySnapshotI18n.init({
    endpoint: "/api/counterparty-form/messages",
    onLanguageChange: ({messages}) => {
        handleCounterpartyFormLanguageChange(messages);
    }
}).then(() => loadCounterparty()).catch((error) => {
    console.error(error);
    if (error?.message) {
        setCounterpartyFormMessage(error.message, "error");
    }
});
