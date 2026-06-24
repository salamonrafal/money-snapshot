const billForm = document.querySelector("#bill-form");
const billFormMessageContainer = document.querySelector("#bill-form-message-container");
const billFormMessage = document.querySelector("#bill-form-message");
const billDurationTypeField = document.querySelector("#bill-duration-type");
const billEndDateField = document.querySelector("#bill-end-date-field");
const billInstallmentsField = document.querySelector("#bill-installments-field");
const billCounterpartySelect = document.querySelector("#bill-counterparty");
const billAccountSelect = document.querySelector("#bill-account");

let billsMessages = {};
let availableAccounts = [];
let availableCounterparties = [];

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

function replaceSelectOptions(select, items, labelSelector) {
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
}

function formatBillAccountOption(account) {
    const bankName = (account.bankName ?? "").trim();
    const accountName = (account.accountName ?? "").trim();

    if (bankName && accountName) {
        return `[${bankName}] ${accountName}`;
    }

    return accountName || bankName || "";
}

function renderBillReferenceOptions() {
    replaceSelectOptions(billCounterpartySelect, availableCounterparties, (item) => item.name ?? "");
    replaceSelectOptions(billAccountSelect, availableAccounts, (item) => formatBillAccountOption(item));
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
    const response = await fetch("/api/bills", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 400 && errorPayload?.fieldErrors) {
        const validationError = new Error(errorPayload.message ?? "Validation failed.");
        validationError.fieldErrors = errorPayload.fieldErrors;
        throw validationError;
    }

    if (response.status === 409) {
        const duplicateError = new Error(errorPayload?.message ?? "Bill with the same name already exists.");
        duplicateError.fieldErrors = {name: true};
        throw duplicateError;
    }

    if (!response.ok) {
        throw new Error(errorPayload?.message ?? "Request failed.");
    }

    return response.json();
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
        await saveBill(buildBillPayload(formData));
        window.location.href = "/bills.html";
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

function handleLanguageChange(nextMessages) {
    billsMessages = nextMessages;
    document.title = `${billsMessages["bills.form.title"]} | ${billsMessages["app.name"]}`;
    syncBillDurationFields();
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

MoneySnapshotI18n.init({
    endpoint: "/api/bills/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
    .then(() => loadBillReferenceData())
    .catch((error) => {
        console.error(error);
        showBillFormMessage(error.message ?? "Request failed.");
    });
