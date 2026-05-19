const snapshotForm = document.querySelector("#snapshot-form");
const formMessage = document.querySelector("#snapshot-form-message");
const accountSelect = document.querySelector("#snapshot-account");
const snapshotDateInput = document.querySelector("#snapshot-date");
const balanceInput = document.querySelector("#snapshot-balance");
const noteInput = document.querySelector("#snapshot-note");
const rememberAccountInput = document.querySelector("#remember-snapshot-account");
const lastSnapshotSummary = document.querySelector("#snapshot-last-summary");
const lastSnapshotSummaryValue = document.querySelector("#snapshot-last-summary-value");

const REMEMBER_ACCOUNT_ENABLED_KEY = "money-snapshot-remember-snapshot-account";
const LAST_ACCOUNT_KEY = "money-snapshot-last-snapshot-account";

const formMode = snapshotForm.dataset.mode;
const snapshotId = snapshotForm.dataset.snapshotId;

let messages = {};
let cachedAccounts = [];
let cachedSnapshots = [];
let loadedSnapshot = null;
let userSettings = null;

function shouldRememberAccount() {
    return window.localStorage.getItem(REMEMBER_ACCOUNT_ENABLED_KEY) === "true";
}

function savedAccountId() {
    return window.localStorage.getItem(LAST_ACCOUNT_KEY) ?? "";
}

function accountExists(accountId) {
    return cachedAccounts.some((account) => account.id === accountId);
}

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    const titleKey = formMode === "edit" ? "snapshots.form.edit.title" : "snapshots.form.title";
    document.title = `${messages[titleKey]} | ${messages["app.name"]}`;
    renderAccountOptions();
    updateLastSnapshotSummary();
}

function setFormMessage(text, type = "") {
    formMessage.textContent = text;
    formMessage.dataset.type = type;
}

function formatAccountOption(account) {
    return `${account.accountName} (${account.bankName}, ${account.currencyCode})`;
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return MoneySnapshotUi.formatDateValue(value, userSettings);
}

function formatCurrencyAmount(snapshot) {
    if (!snapshot) {
        return "-";
    }

    return MoneySnapshotUi.formatMoneyValue(snapshot.balance, userSettings);
}

function renderAccountOptions() {
    const rememberedAccountId = formMode === "create" && shouldRememberAccount() ? savedAccountId() : "";
    const selectedValue = accountSelect.value || loadedSnapshot?.accountId || rememberedAccountId || "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = messages["snapshots.form.accountPlaceholder"] ?? "";

    accountSelect.replaceChildren(
            placeholder,
            ...cachedAccounts.map((account) => {
                const option = document.createElement("option");
                option.value = account.id;
                option.textContent = formatAccountOption(account);
                return option;
            })
    );
    accountSelect.value = accountExists(selectedValue) ? selectedValue : "";
}

async function loadAccounts() {
    const response = await fetch("/api/accounts");
    if (!response.ok) {
        throw new Error(messages["snapshots.error.loadAccounts"]);
    }

    cachedAccounts = await response.json();
    renderAccountOptions();
    updateLastSnapshotSummary();
}

async function loadSnapshotHistory() {
    if (formMode !== "create") {
        return;
    }

    const response = await fetch("/api/snapshots");
    if (!response.ok) {
        throw new Error(messages["snapshots.error.load"]);
    }

    cachedSnapshots = await response.json();
    updateLastSnapshotSummary();
}

async function loadSnapshot() {
    if (formMode !== "edit") {
        return;
    }

    const response = await fetch(`/api/snapshots/${encodeURIComponent(snapshotId)}`);
    if (response.status === 404) {
        throw new Error(messages["snapshots.error.notFound"]);
    }

    if (!response.ok) {
        throw new Error(messages["snapshots.error.loadSnapshot"]);
    }

    loadedSnapshot = await response.json();
    accountSelect.value = loadedSnapshot.accountId;
    snapshotDateInput.value = loadedSnapshot.snapshotDate;
    balanceInput.value = loadedSnapshot.balance;
    noteInput.value = loadedSnapshot.note ?? "";
}

async function saveSnapshot(payload) {
    const isEdit = formMode === "edit";
    const response = await fetch(isEdit ? `/api/snapshots/${encodeURIComponent(snapshotId)}` : "/api/snapshots", {
        method: isEdit ? "PUT" : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (response.status === 404) {
        throw new Error(messages["snapshots.error.accountNotFound"]);
    }

    if (response.status === 409) {
        throw new Error(messages["snapshots.error.duplicate"]);
    }

    if (!response.ok) {
        throw new Error(messages[isEdit ? "snapshots.error.update" : "snapshots.error.create"]);
    }

    return response.json();
}

snapshotForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        accountId: accountSelect.value,
        snapshotDate: snapshotDateInput.value,
        balance: balanceInput.value,
        note: noteInput.value.trim()
    };

    if (!payload.accountId || !payload.snapshotDate || !payload.balance) {
        setFormMessage(messages["snapshots.form.required"], "error");
        return;
    }

    snapshotForm.querySelector("button[type='submit']").disabled = true;
    setFormMessage("");

    try {
        const savedSnapshot = await saveSnapshot(payload);
        if (formMode === "create") {
            cachedSnapshots = [savedSnapshot, ...cachedSnapshots.filter((snapshot) => snapshot.id !== savedSnapshot.id)];
        }
        rememberSelectedAccount(payload.accountId);
        if (formMode === "edit") {
            window.location.href = "/snapshots.html";
            return;
        }

        snapshotForm.reset();
        restoreRememberAccountPreference();
        renderAccountOptions();
        setRememberedAccountDateFromLastSnapshot();
        updateLastSnapshotSummary();
        setFormMessage(messages["snapshots.form.success"], "success");
    } catch (error) {
        setFormMessage(error.message, "error");
    } finally {
        snapshotForm.querySelector("button[type='submit']").disabled = false;
        accountSelect.focus();
    }
});

function rememberSelectedAccount(accountId) {
    if (!rememberAccountInput) {
        return;
    }

    if (rememberAccountInput.checked) {
        window.localStorage.setItem(REMEMBER_ACCOUNT_ENABLED_KEY, "true");
        window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
        return;
    }

    window.localStorage.removeItem(REMEMBER_ACCOUNT_ENABLED_KEY);
    window.localStorage.removeItem(LAST_ACCOUNT_KEY);
}

function rememberCurrentAccountIfEnabled() {
    if (rememberAccountInput?.checked && accountSelect.value) {
        rememberSelectedAccount(accountSelect.value);
    }
}

function lastSnapshotForSelectedAccount() {
    if (!accountSelect.value) {
        return null;
    }

    return cachedSnapshots
            .filter((snapshot) => snapshot.accountId === accountSelect.value)
            .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))[0] ?? null;
}

function setRememberedAccountDateFromLastSnapshot() {
    if (formMode !== "create" || !rememberAccountInput?.checked) {
        setDefaultSnapshotDate();
        return;
    }

    const lastSnapshot = lastSnapshotForSelectedAccount();
    snapshotDateInput.value = lastSnapshot?.snapshotDate ?? MoneySnapshotUi.localIsoDate();
}

function updateLastSnapshotSummary() {
    if (!lastSnapshotSummary || !lastSnapshotSummaryValue) {
        return;
    }

    const lastSnapshot = lastSnapshotForSelectedAccount();
    if (!accountSelect.value) {
        lastSnapshotSummary.hidden = true;
        lastSnapshotSummaryValue.textContent = "-";
        return;
    }

    lastSnapshotSummary.hidden = false;
    lastSnapshotSummaryValue.textContent = lastSnapshot
            ? `${formatDate(lastSnapshot.snapshotDate)} · ${formatCurrencyAmount(lastSnapshot)}`
            : messages["snapshots.form.noLastSnapshot"] ?? "-";
}

function restoreRememberAccountPreference() {
    if (rememberAccountInput) {
        rememberAccountInput.checked = shouldRememberAccount();
    }
}

rememberAccountInput?.addEventListener("change", () => {
    if (!rememberAccountInput.checked) {
        window.localStorage.removeItem(REMEMBER_ACCOUNT_ENABLED_KEY);
        window.localStorage.removeItem(LAST_ACCOUNT_KEY);
        return;
    }

    window.localStorage.setItem(REMEMBER_ACCOUNT_ENABLED_KEY, "true");
    rememberCurrentAccountIfEnabled();
    setRememberedAccountDateFromLastSnapshot();
    updateLastSnapshotSummary();
});

accountSelect.addEventListener("change", () => {
    rememberCurrentAccountIfEnabled();
    setRememberedAccountDateFromLastSnapshot();
    updateLastSnapshotSummary();
});

function setDefaultSnapshotDate() {
    if (formMode !== "edit") {
        snapshotDateInput.value = MoneySnapshotUi.localIsoDate();
    }
}

setDefaultSnapshotDate();
restoreRememberAccountPreference();

MoneySnapshotI18n.init({
    endpoint: "/api/snapshots/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadAccounts)
        .then(loadSnapshotHistory)
        .then(loadSnapshot)
        .then(() => {
            setRememberedAccountDateFromLastSnapshot();
            updateLastSnapshotSummary();
        })
        .catch((error) => {
            setFormMessage(error.message, "error");
        });
