const accountForm = document.querySelector("#account-form");
const accountFormMessage = document.querySelector("#account-form-message");
const accountNameInput = document.querySelector("#account-name");
const accountBankSelect = document.querySelector("#account-bank");
const accountTypeSelect = document.querySelector("#account-type");
const accountCurrencySelect = document.querySelector("#account-currency");
const accountStatusSelect = document.querySelector("#account-status");
const accountDescriptionInput = document.querySelector("#account-description");

const formMode = accountForm.dataset.mode;
const accountId = accountForm.dataset.accountId;

let messages = {};
let cachedBanks = [];
let loadedAccount = null;

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    const titleKey = formMode === "edit" ? "accounts.form.edit.title" : "accounts.form.title";
    document.title = `${messages[titleKey]} | ${messages["app.name"]}`;
    renderBankOptions();
}

function setFormMessage(text, type = "") {
    accountFormMessage.textContent = text;
    accountFormMessage.dataset.type = type;
}

function renderBankOptions() {
    const selectedValue = accountBankSelect.value || loadedAccount?.bankName || "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = messages["accounts.form.bankPlaceholder"] ?? "";

    accountBankSelect.replaceChildren(
            placeholder,
            ...cachedBanks.map((bank) => {
                const option = document.createElement("option");
                option.value = bank.name;
                option.textContent = bank.name;
                return option;
            })
    );
    accountBankSelect.value = selectedValue;
}

async function loadBanks() {
    const response = await fetch("/api/banks");
    if (!response.ok) {
        throw new Error(messages["accounts.error.loadBanks"]);
    }

    cachedBanks = await response.json();
    renderBankOptions();
}

async function loadAccount() {
    if (formMode !== "edit") {
        return;
    }

    const response = await fetch(`/api/accounts/${encodeURIComponent(accountId)}`);
    if (response.status === 404) {
        throw new Error(messages["accounts.error.notFound"]);
    }

    if (!response.ok) {
        throw new Error(messages["accounts.error.loadAccount"]);
    }

    loadedAccount = await response.json();
    accountNameInput.value = loadedAccount.accountName;
    accountBankSelect.value = loadedAccount.bankName;
    accountTypeSelect.value = loadedAccount.accountTypeCode;
    accountCurrencySelect.value = loadedAccount.currencyCode;
    accountStatusSelect.value = loadedAccount.status;
    accountDescriptionInput.value = loadedAccount.description ?? "";
}

function payloadFromForm() {
    return {
        accountName: accountNameInput.value.trim(),
        bankName: accountBankSelect.value,
        accountTypeCode: accountTypeSelect.value,
        currencyCode: accountCurrencySelect.value,
        description: accountDescriptionInput.value.trim(),
        status: accountStatusSelect.value
    };
}

async function saveAccount(payload) {
    const isEdit = formMode === "edit";
    const response = await fetch(isEdit ? `/api/accounts/${encodeURIComponent(accountId)}` : "/api/accounts", {
        method: isEdit ? "PUT" : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (response.status === 404) {
        throw new Error(messages["accounts.error.notFound"]);
    }

    if (response.status === 409) {
        throw new Error(messages["accounts.error.duplicate"]);
    }

    if (!response.ok) {
        throw new Error(messages[isEdit ? "accounts.error.update" : "accounts.error.create"]);
    }

    return response.json();
}

accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = payloadFromForm();
    if (!payload.accountName || !payload.bankName || !payload.accountTypeCode || !payload.currencyCode || !payload.status) {
        setFormMessage(messages["accounts.form.required"], "error");
        return;
    }

    accountForm.querySelector("button[type='submit']").disabled = true;
    setFormMessage("");

    try {
        await saveAccount(payload);
        window.location.href = "/accounts.html";
    } catch (error) {
        setFormMessage(error.message, "error");
        accountForm.querySelector("button[type='submit']").disabled = false;
        accountNameInput.focus();
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/accounts/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(loadBanks)
        .then(loadAccount)
        .catch((error) => {
            setFormMessage(error.message, "error");
        });
