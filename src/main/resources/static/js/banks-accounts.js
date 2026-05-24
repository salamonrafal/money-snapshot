const tableBody = document.querySelector("#bank-account-table-body");
const listMessage = document.querySelector("#bank-account-list-message");
const refreshButton = document.querySelector("#refresh-bank-account-list");
const pageParams = new URLSearchParams(window.location.search);
const infoModal = document.querySelector("#entity-info-modal");
const infoModalTitle = document.querySelector("#entity-info-title");
const infoModalList = document.querySelector("#entity-info-list");
const infoModalCloseButton = document.querySelector("#entity-info-close");

const deleteBankModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-bank-modal",
    subjectSelector: "#delete-bank-name",
    confirmSelector: "#confirm-delete-bank",
    cancelSelector: "#cancel-delete-bank"
});

const deleteAccountModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-account-modal",
    subjectSelector: "#delete-account-name",
    confirmSelector: "#confirm-delete-account",
    cancelSelector: "#cancel-delete-account"
});

let messages = {};
let userSettings = null;
let cachedBanks = [];
let cachedAccounts = [];
let dataLoaded = false;
let infoModalState = null;
let infoModalTrigger = null;
const expandedBankIds = new Set();
const highlightedAccountId = pageParams.get("highlightAccount") ?? "";

function applyInitialExpansionState() {
    const expandBankId = pageParams.get("expandBank");
    if (expandBankId) {
        expandedBankIds.add(expandBankId);
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

function accountTypeLabel(accountTypeCode) {
    return messages[`accounts.accountType.${accountTypeCode}`] ?? accountTypeCode;
}

function setMessage(element, text, type = "") {
    element.textContent = text;
    element.dataset.type = type;
}

function renderInfoModal() {
    if (!infoModalState) {
        return;
    }

    const {kind, entity, accountCount = 0} = infoModalState;
    const title = kind === "bank"
        ? messages["banksAccounts.info.bankTitle"]
        : messages["banksAccounts.info.accountTitle"];
    const fields = kind === "bank"
        ? buildBankInfoFields(entity, accountCount)
        : buildAccountInfoFields(entity);

    infoModalTitle.textContent = title;
    infoModalList.replaceChildren(...fields.map(({label, value}) => {
        const fragment = document.createDocumentFragment();
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.textContent = label;
        detail.textContent = value;
        fragment.append(term, detail);
        return fragment;
    }));
}

function modalFocusableElements() {
    if (!infoModal) {
        return [];
    }

    return [...infoModal.querySelectorAll(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )].filter((element) => !element.hasAttribute("hidden"));
}

function openInfoModal(kind, entity, accountCount = 0, triggerElement = null) {
    infoModalState = {kind, entity, accountCount};
    infoModalTrigger = triggerElement;
    renderInfoModal();
    infoModal.hidden = false;
    infoModalCloseButton.focus();
}

function closeInfoModal() {
    infoModalState = null;
    infoModal.hidden = true;
    if (infoModalTrigger instanceof HTMLElement) {
        infoModalTrigger.focus();
    }
    infoModalTrigger = null;
}

function buildBankInfoFields(bank, accountCount) {
    const fields = [
        {label: messages["banks.table.name"], value: bank.name},
        {label: messages["banks.table.normalizedName"], value: bank.normalizedName},
        {label: messages["banksAccounts.table.accounts"], value: String(accountCount)},
        {label: messages["banksAccounts.info.owner"], value: bank.ownerName || messages["banksAccounts.info.notAvailable"]},
        {label: messages["banksAccounts.info.createdAt"], value: formatDateTime(bank.createdAt)},
        {label: messages["banksAccounts.info.updatedAt"], value: formatDateTime(bank.updatedAt)}
    ];
    return fields;
}

function buildAccountInfoFields(account) {
    const description = account.description?.trim();
    const fields = [
        {label: messages["accounts.table.name"], value: account.accountName},
        {label: messages["accounts.table.bank"], value: account.bankName},
        {label: messages["banks.table.normalizedName"], value: account.normalizedName},
        {label: messages["accounts.table.accountType"], value: accountTypeLabel(account.accountTypeCode)},
        {label: messages["accounts.table.currency"], value: account.currencyCode},
        {label: messages["accounts.table.status"], value: statusLabel(account.status)},
        {label: messages["banksAccounts.info.owner"], value: account.ownerName || messages["banksAccounts.info.notAvailable"]},
        {label: messages["banksAccounts.info.createdAt"], value: formatDateTime(account.createdAt)},
        {label: messages["banksAccounts.info.updatedAt"], value: formatDateTime(account.updatedAt)}
    ];

    if (description) {
        fields.push({label: messages["accounts.form.description"], value: description});
    }

    return fields;
}

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    document.title = `${messages["banksAccounts.heading.title"]} | ${messages["app.name"]}`;
    if (!infoModal.hidden) {
        renderInfoModal();
    }
    if (dataLoaded) {
        renderBankAccounts();
    }
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function accountsByBankId() {
    return cachedAccounts.reduce((map, account) => {
        const key = account.bankId ?? "";
        const items = map.get(key) ?? [];
        items.push(account);
        map.set(key, items);
        return map;
    }, new Map());
}

function createAccountTable(accounts) {
    const wrapper = document.createElement("div");
    wrapper.className = "banks-accounts-nested-wrap";

    const nestedTable = document.createElement("table");
    nestedTable.className = "accounts-table banks-accounts-nested-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>${messages["accounts.table.name"] ?? ""}</th>
            <th>${messages["accounts.table.accountType"] ?? ""}</th>
            <th>${messages["accounts.table.currency"] ?? ""}</th>
            <th>${messages["accounts.table.status"] ?? ""}</th>
            <th>${messages["accounts.table.actions"] ?? ""}</th>
        </tr>
    `;

    const tbody = document.createElement("tbody");

    if (accounts.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = messages["accounts.empty"] ?? "";
        row.append(cell);
        tbody.append(row);
    } else {
        accounts.forEach((account) => {
            const row = document.createElement("tr");
            if (highlightedAccountId && account.id === highlightedAccountId) {
                row.classList.add("bank-account-highlight");
            }
            [
                account.accountName,
                accountTypeLabel(account.accountTypeCode),
                account.currencyCode,
                statusLabel(account.status)
            ].forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.append(cell);
            });

            const actionsCell = document.createElement("td");
            const actions = document.createElement("div");
            const infoButton = document.createElement("button");
            const editButton = document.createElement("button");
            const deleteButton = document.createElement("button");
            actions.className = "row-actions";

            infoButton.type = "button";
            infoButton.className = "icon-button";
            infoButton.setAttribute("aria-label", messages["banksAccounts.actions.info"]);
            MoneySnapshotUi.setTooltip(infoButton, messages["banksAccounts.actions.info"]);
            infoButton.append(MoneySnapshotUi.createInfoIcon());
            infoButton.addEventListener("click", () => {
                openInfoModal("account", account, 0, infoButton);
            });

            editButton.type = "button";
            editButton.className = "icon-button";
            editButton.setAttribute("aria-label", messages["accounts.actions.edit"]);
            MoneySnapshotUi.setTooltip(editButton, messages["accounts.actions.edit"]);
            editButton.append(MoneySnapshotUi.createEditIcon());
            editButton.addEventListener("click", () => {
                window.location.href = `/accounts/${encodeURIComponent(account.id)}/edit.html?returnTo=${encodeURIComponent("/banks-accounts.html")}`;
            });

            deleteButton.type = "button";
            deleteButton.className = "icon-button danger";
            deleteButton.setAttribute("aria-label", messages["accounts.actions.delete"]);
            MoneySnapshotUi.setTooltip(deleteButton, messages["accounts.actions.delete"]);
            deleteButton.append(MoneySnapshotUi.createTrashIcon());
            deleteButton.addEventListener("click", () => {
                deleteAccountModal.open(account, account.accountName);
            });

            actions.append(infoButton, editButton, deleteButton);
            actionsCell.append(actions);
            row.append(actionsCell);
            tbody.append(row);
        });
    }

    nestedTable.append(thead, tbody);
    wrapper.append(nestedTable);
    return wrapper;
}

function renderBankAccounts() {
    dataLoaded = true;
    if (cachedBanks.length === 0) {
        renderEmpty(messages["banks.empty"] ?? "");
        return;
    }

    const accountsMap = accountsByBankId();
    const rows = [];

    cachedBanks.forEach((bank) => {
        const bankAccounts = accountsMap.get(bank.id) ?? [];
        const expanded = expandedBankIds.has(bank.id);
        const row = document.createElement("tr");
        row.className = "bank-summary-row";

        const nameCell = document.createElement("td");
        const toggleButton = document.createElement("button");
        const chevron = document.createElement("span");
        const label = document.createElement("span");
        toggleButton.type = "button";
        toggleButton.className = "bank-toggle";
        toggleButton.setAttribute("aria-expanded", expanded ? "true" : "false");
        toggleButton.setAttribute("aria-label", expanded
            ? (messages["banksAccounts.table.collapse"] ?? "")
            : (messages["banksAccounts.table.expand"] ?? ""));
        chevron.className = "bank-toggle-chevron";
        chevron.setAttribute("aria-hidden", "true");
        label.textContent = bank.name;
        toggleButton.append(chevron, label);
        toggleButton.addEventListener("click", () => {
            if (expandedBankIds.has(bank.id)) {
                expandedBankIds.delete(bank.id);
            } else {
                expandedBankIds.add(bank.id);
            }
            renderBankAccounts();
        });
        nameCell.append(toggleButton);

        const normalizedCell = document.createElement("td");
        normalizedCell.textContent = bank.normalizedName;

        const countCell = document.createElement("td");
        countCell.textContent = `${bankAccounts.length}`;

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        const addAccountButton = document.createElement("button");
        const infoButton = document.createElement("button");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");
        actions.className = "row-actions";

        addAccountButton.type = "button";
        addAccountButton.className = "icon-button";
        addAccountButton.setAttribute("aria-label", messages["accounts.actions.add"]);
        MoneySnapshotUi.setTooltip(addAccountButton, messages["accounts.actions.add"]);
        addAccountButton.append(MoneySnapshotUi.createAddIcon());
        addAccountButton.addEventListener("click", () => {
            window.location.href = `/accounts/new.html?bank=${encodeURIComponent(bank.name)}&returnTo=${encodeURIComponent("/banks-accounts.html")}`;
        });

        infoButton.type = "button";
        infoButton.className = "icon-button";
        infoButton.setAttribute("aria-label", messages["banksAccounts.actions.info"]);
        MoneySnapshotUi.setTooltip(infoButton, messages["banksAccounts.actions.info"]);
        infoButton.append(MoneySnapshotUi.createInfoIcon());
        infoButton.addEventListener("click", () => {
            openInfoModal("bank", bank, bankAccounts.length, infoButton);
        });

        editButton.type = "button";
        editButton.className = "icon-button";
        editButton.setAttribute("aria-label", messages["banks.actions.edit"]);
        MoneySnapshotUi.setTooltip(editButton, messages["banks.actions.edit"]);
        editButton.append(MoneySnapshotUi.createEditIcon());
        editButton.addEventListener("click", () => {
            window.location.href = `/banks/${encodeURIComponent(bank.id)}/edit.html?returnTo=${encodeURIComponent(`/banks-accounts.html?expandBank=${bank.id}`)}`;
        });

        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.setAttribute("aria-label", messages["banks.actions.delete"]);
        MoneySnapshotUi.setTooltip(deleteButton, messages["banks.actions.delete"]);
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteBankModal.open(bank, bank.name);
        });

        actions.append(addAccountButton, infoButton, editButton, deleteButton);
        actionsCell.append(actions);

        row.append(nameCell, normalizedCell, countCell, actionsCell);
        rows.push(row);

        const detailsRow = document.createElement("tr");
        detailsRow.className = "bank-details-row";
        if (!expanded) {
            detailsRow.hidden = true;
        }

        const detailsCell = document.createElement("td");
        detailsCell.colSpan = 4;
        detailsCell.className = "bank-details-cell";
        if (expanded) {
            detailsCell.append(createAccountTable(bankAccounts));
        }
        detailsRow.append(detailsCell);
        rows.push(detailsRow);
    });

    tableBody.replaceChildren(...rows);

    if (highlightedAccountId) {
        const highlightedRow = tableBody.querySelector(".bank-account-highlight");
        highlightedRow?.scrollIntoView({block: "nearest"});
    }
}

async function loadBanks() {
    const response = await fetch("/api/banks");
    if (!response.ok) {
        throw new Error(messages["banks.error.load"]);
    }

    cachedBanks = await response.json();
}

async function loadAccounts() {
    const response = await fetch("/api/accounts");
    if (!response.ok) {
        throw new Error(messages["accounts.error.load"]);
    }

    cachedAccounts = await response.json();
}

async function deleteBank(id) {
    const response = await fetch(`/api/banks/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });

    if (response.status === 404) {
        throw new Error(messages["banks.error.notFound"]);
    }

    if (response.status === 409) {
        throw new Error(messages["banks.error.inUse"]);
    }

    if (!response.ok) {
        throw new Error(messages["banks.error.delete"]);
    }
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

async function loadAll() {
    await Promise.all([loadBanks(), loadAccounts()]);
    renderBankAccounts();
}

refreshButton.addEventListener("click", () => {
    setMessage(listMessage, "");
    loadAll().catch((error) => {
        renderEmpty(error.message);
    });
});

infoModalCloseButton.addEventListener("click", closeInfoModal);

infoModal.addEventListener("click", (event) => {
    if (event.target === infoModal) {
        closeInfoModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !infoModal.hidden) {
        closeInfoModal();
        return;
    }

    if (event.key === "Tab" && !infoModal.hidden) {
        const focusable = modalFocusableElements();
        if (focusable.length === 0) {
            event.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }
});

deleteBankModal.confirmButton.addEventListener("click", async () => {
    const selectedBank = deleteBankModal.getSelectedItem();
    if (!selectedBank) {
        return;
    }

    deleteBankModal.confirmButton.disabled = true;
    setMessage(listMessage, "");

    try {
        await deleteBank(selectedBank.id);
        deleteBankModal.close();
        setMessage(listMessage, messages["banks.delete.success"], "success");
        await loadAll();
    } catch (error) {
        deleteBankModal.close();
        setMessage(listMessage, error.message, "error");
    } finally {
        deleteBankModal.confirmButton.disabled = false;
    }
});

deleteAccountModal.confirmButton.addEventListener("click", async () => {
    const selectedAccount = deleteAccountModal.getSelectedItem();
    if (!selectedAccount) {
        return;
    }

    deleteAccountModal.confirmButton.disabled = true;
    setMessage(listMessage, "");

    try {
        await deleteAccount(selectedAccount.id);
        deleteAccountModal.close();
        setMessage(listMessage, messages["accounts.delete.success"], "success");
        await loadAll();
    } catch (error) {
        deleteAccountModal.close();
        setMessage(listMessage, error.message, "error");
    } finally {
        deleteAccountModal.confirmButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/banks-accounts/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(() => {
            applyInitialExpansionState();
        })
        .then(loadAll)
        .catch((error) => {
            renderEmpty(error.message);
        });
