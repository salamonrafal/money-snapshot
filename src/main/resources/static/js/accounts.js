const tableBody = document.querySelector("#accounts-table-body");
const refreshButton = document.querySelector("#refresh-accounts");
const listMessage = document.querySelector("#accounts-list-message");
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-account-modal",
    subjectSelector: "#delete-account-name",
    confirmSelector: "#confirm-delete-account",
    cancelSelector: "#cancel-delete-account"
});

let currentLanguage = "pl";
let messages = {};
let cachedAccounts = [];
let accountsLoaded = false;
let userSettings = null;

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    document.title = `${messages["accounts.heading.title"]} | ${messages["app.name"]}`;
    if (accountsLoaded) {
        renderAccounts(cachedAccounts);
    }
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    return MoneySnapshotUi.formatDateTimeValue(value, userSettings);
}

function statusLabel(status) {
    return messages[`accounts.status.${status}`] ?? status;
}

function setListMessage(text, type = "") {
    listMessage.textContent = text;
    listMessage.dataset.type = type;
}

function accountTypeLabel(accountTypeCode) {
    return messages[`accounts.accountType.${accountTypeCode}`] ?? accountTypeCode;
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function renderAccounts(accounts) {
    cachedAccounts = accounts;
    accountsLoaded = true;

    if (accounts.length === 0) {
        renderEmpty(messages["accounts.empty"] ?? "");
        return;
    }

    tableBody.replaceChildren(...accounts.map((account) => {
        const row = document.createElement("tr");
        [
            account.accountName,
            account.bankName,
            accountTypeLabel(account.accountTypeCode),
            account.currencyCode,
            statusLabel(account.status),
            formatDateTime(account.createdAt),
            formatDateTime(account.updatedAt)
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
        });

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");
        actions.className = "row-actions";

        editButton.type = "button";
        editButton.className = "icon-button";
        editButton.title = messages["accounts.actions.edit"];
        editButton.setAttribute("aria-label", messages["accounts.actions.edit"]);
        editButton.append(MoneySnapshotUi.createEditIcon());
        editButton.addEventListener("click", () => {
            window.location.href = `/accounts/${encodeURIComponent(account.id)}/edit.html`;
        });

        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.title = messages["accounts.actions.delete"];
        deleteButton.setAttribute("aria-label", messages["accounts.actions.delete"]);
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteModal.open(account, account.accountName);
        });
        actions.append(editButton, deleteButton);
        actionsCell.append(actions);
        row.append(actionsCell);

        return row;
    }));
}

async function loadAccounts() {
    const response = await fetch("/api/accounts");
    if (!response.ok) {
        throw new Error(messages["accounts.error.load"]);
    }

    renderAccounts(await response.json());
}

async function deleteAccount(id) {
    const response = await fetch(`/api/accounts/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });

    if (response.status === 404) {
        throw new Error(messages["accounts.error.notFound"]);
    }

    if (response.status === 409) {
        throw new Error(messages["accounts.error.inUse"]);
    }

    if (!response.ok) {
        throw new Error(messages["accounts.error.delete"]);
    }
}

refreshButton.addEventListener("click", () => {
    setListMessage("");
    loadAccounts().catch((error) => {
        renderEmpty(error.message);
    });
});

deleteModal.confirmButton.addEventListener("click", async () => {
    const selectedAccount = deleteModal.getSelectedItem();
    if (!selectedAccount) {
        return;
    }

    deleteModal.confirmButton.disabled = true;
    setListMessage("");

    try {
        await deleteAccount(selectedAccount.id);
        deleteModal.close();
        setListMessage(messages["accounts.delete.success"], "success");
        await loadAccounts();
    } catch (error) {
        deleteModal.close();
        setListMessage(error.message, "error");
    } finally {
        deleteModal.confirmButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/accounts/messages",
    onLanguageChange: ({language, messages}) => {
        handleLanguageChange(language, messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadAccounts)
        .catch((error) => {
            renderEmpty(error.message);
        });
