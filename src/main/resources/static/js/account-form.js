const accountForm = document.querySelector("#account-form");
const accountFormMessage = document.querySelector("#account-form-message");
const accountNameInput = document.querySelector("#account-name");
const accountBankSelect = document.querySelector("#account-bank");
const accountTypeSelect = document.querySelector("#account-type");
const accountCurrencySelect = document.querySelector("#account-currency");
const accountStatusSelect = document.querySelector("#account-status");
const accountBankAccountNumberInput = document.querySelector("#account-bank-account-number");
const accountBankAccountNumberBankInfo = document.querySelector("#account-bank-account-number-bank-info");
const accountShowInSnapshotsInput = document.querySelector("#account-show-in-snapshots");
const accountDescriptionInput = document.querySelector("#account-description");
const cancelLink = document.querySelector(".split-actions a.button.secondary");

const formMode = accountForm.dataset.mode;
const accountId = accountForm.dataset.accountId;
const searchParams = new URLSearchParams(window.location.search);
const preselectedBankName = searchParams.get("bank") ?? "";
const returnTo = searchParams.get("returnTo") ?? "";
const BANKS_ACCOUNTS_NOTIFICATION_KEY = "money-snapshot-banks-accounts-notification";

let messages = {};
let cachedBanks = [];
let loadedAccount = null;

function setBankAccountInfo(text) {
    if (!accountBankAccountNumberBankInfo) {
        return;
    }

    accountBankAccountNumberBankInfo.textContent = text;
    accountBankAccountNumberBankInfo.classList.toggle("is-empty", !text);
}

function updateBankAccountInfo() {
    const rawValue = accountBankAccountNumberInput?.value ?? "";
    const normalizedValue = MoneySnapshotUi.normalizeBankAccountNumber(rawValue);
    if (!normalizedValue || !isValidBankAccountNumber(normalizedValue)) {
        setBankAccountInfo("");
        return;
    }

    const label = messages["accounts.form.bankAccountNumberHint"] ?? "";
    const bankName = MoneySnapshotUi.resolvePolishBankNameFromAccountNumber(normalizedValue)
        || (messages["accounts.form.bankNameUnknown"] ?? "");
    setBankAccountInfo(`${label}: ${bankName}`);
}

function isValidBankAccountNumber(value) {
    const normalized = MoneySnapshotUi.normalizeBankAccountNumber(value);
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

function resolveRedirectUrl() {
    const safePath = MoneySnapshotUi.safeReturnToPath(returnTo);
    if (safePath) {
        return safePath;
    }

    return "/accounts.html";
}

function syncCancelLink() {
    if (!cancelLink) {
        return;
    }

    cancelLink.href = resolveRedirectUrl();
}

function buildReturnUrl(savedAccount) {
    const safePath = MoneySnapshotUi.safeReturnToPath(returnTo);
    if (!safePath) {
        return resolveRedirectUrl();
    }

    const url = new URL(safePath, window.location.origin);
    if (savedAccount?.bankId) {
        url.searchParams.set("expandBank", savedAccount.bankId);
    }
    if (savedAccount?.id) {
        url.searchParams.set("highlightAccount", savedAccount.id);
    }
    return `${url.pathname}${url.search}${url.hash}`;
}

function persistBanksAccountsNotification(messageKey, type = "success", savedAccount = null) {
    const redirectUrl = buildReturnUrl(savedAccount);
    if (!redirectUrl.startsWith("/banks-accounts.html")) {
        return;
    }

    try {
        window.sessionStorage.setItem(BANKS_ACCOUNTS_NOTIFICATION_KEY, JSON.stringify({
            messageKey,
            type
        }));
    } catch (error) {
        console.warn("Cannot save banks-accounts notification state", error);
    }
}

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
    const selectedValue = accountBankSelect.value || loadedAccount?.bankName || (formMode === "create" ? preselectedBankName : "");
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
    accountBankAccountNumberInput.value = loadedAccount.bankAccountNumber ?? "";
    accountShowInSnapshotsInput.checked = loadedAccount.showInSnapshots !== false;
    accountDescriptionInput.value = loadedAccount.description ?? "";
    updateBankAccountInfo();
}

function payloadFromForm() {
    return {
        accountName: accountNameInput.value.trim(),
        bankName: accountBankSelect.value,
        accountTypeCode: accountTypeSelect.value,
        currencyCode: accountCurrencySelect.value,
        bankAccountNumber: MoneySnapshotUi.normalizeBankAccountNumber(accountBankAccountNumberInput.value) || null,
        showInSnapshots: accountShowInSnapshotsInput.checked,
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

    if (response.status === 400) {
        const errorBody = await response.json().catch(() => null);
        if (errorBody?.fieldErrors?.bankAccountNumber === "ValidBankAccountNumber") {
            throw new Error(messages["accounts.form.invalidBankAccountNumber"]);
        }
        throw new Error(messages["accounts.form.required"]);
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
    if (payload.bankAccountNumber && !isValidBankAccountNumber(payload.bankAccountNumber)) {
        setFormMessage(messages["accounts.form.invalidBankAccountNumber"], "error");
        accountBankAccountNumberInput.focus();
        return;
    }

    accountForm.querySelector("button[type='submit']").disabled = true;
    setFormMessage("");

    try {
        const savedAccount = await saveAccount(payload);
        persistBanksAccountsNotification("accounts.form.success", "success", savedAccount);
        window.location.href = buildReturnUrl(savedAccount);
    } catch (error) {
        setFormMessage(error.message, "error");
        accountForm.querySelector("button[type='submit']").disabled = false;
        if (error.message === messages["accounts.form.invalidBankAccountNumber"]) {
            accountBankAccountNumberInput.focus();
        } else {
            accountNameInput.focus();
        }
    }
});

accountBankAccountNumberInput?.addEventListener("input", () => {
    updateBankAccountInfo();
});

MoneySnapshotI18n.init({
    endpoint: "/api/accounts/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(() => {
            syncCancelLink();
        })
        .then(loadBanks)
        .then(loadAccount)
        .then(updateBankAccountInfo)
        .catch((error) => {
            setFormMessage(error.message, "error");
        });
