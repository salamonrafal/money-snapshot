const tableBody = document.querySelector("#bank-account-table-body");
const listMessage = document.querySelector("#bank-account-list-message");
const refreshButton = document.querySelector("#refresh-bank-account-list");
const newBankAction = document.querySelector("#new-bank-action");
const newAccountAction = document.querySelector("#new-account-action");
const editBankModalForm = document.querySelector("#edit-bank-form");
const editBankNameInput = document.querySelector("#edit-bank-name");
const editBankFormMessageContainer = document.querySelector("#edit-bank-form-message-container");
const editBankFormMessage = document.querySelector("#edit-bank-form-message");
const editBankSubmitButton = document.querySelector("#edit-bank-submit");
const newBankModalForm = document.querySelector("#new-bank-form");
const newBankNameInput = document.querySelector("#new-bank-name");
const newBankFormMessageContainer = document.querySelector("#new-bank-form-message-container");
const newBankFormMessage = document.querySelector("#new-bank-form-message");
const newBankSubmitButton = document.querySelector("#new-bank-submit");
const editAccountModalForm = document.querySelector("#edit-account-form");
const editAccountNameInput = document.querySelector("#edit-account-name");
const editAccountBankSelect = document.querySelector("#edit-account-bank");
const editAccountTypeSelect = document.querySelector("#edit-account-type");
const editAccountCurrencySelect = document.querySelector("#edit-account-currency");
const editAccountStatusSelect = document.querySelector("#edit-account-status");
const editAccountDescriptionInput = document.querySelector("#edit-account-description");
const editAccountFormMessageContainer = document.querySelector("#edit-account-form-message-container");
const editAccountFormMessage = document.querySelector("#edit-account-form-message");
const editAccountSubmitButton = document.querySelector("#edit-account-submit");
const newAccountModalForm = document.querySelector("#new-account-form");
const newAccountNameInput = document.querySelector("#new-account-name");
const newAccountBankSelect = document.querySelector("#new-account-bank");
const newAccountTypeSelect = document.querySelector("#new-account-type");
const newAccountCurrencySelect = document.querySelector("#new-account-currency");
const newAccountStatusSelect = document.querySelector("#new-account-status");
const newAccountDescriptionInput = document.querySelector("#new-account-description");
const newAccountFormMessageContainer = document.querySelector("#new-account-form-message-container");
const newAccountFormMessage = document.querySelector("#new-account-form-message");
const newAccountSubmitButton = document.querySelector("#new-account-submit");
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
const toastManager = MoneySnapshotUi.createToastManager({
    durationMs: 5000
});
const BANKS_ACCOUNTS_NOTIFICATION_KEY = "money-snapshot-banks-accounts-notification";

const editBankModal = MoneySnapshotUi.createModal({
    modalSelector: "#edit-bank-modal",
    closeSelectors: ["#edit-bank-modal [data-edit-bank-modal-close]"]
});

const newBankModal = MoneySnapshotUi.createModal({
    modalSelector: "#new-bank-modal",
    closeSelectors: ["#new-bank-modal [data-new-bank-modal-close]"]
});

const editAccountModal = MoneySnapshotUi.createModal({
    modalSelector: "#edit-account-modal",
    closeSelectors: ["#edit-account-modal [data-edit-account-modal-close]"]
});

const newAccountModal = MoneySnapshotUi.createModal({
    modalSelector: "#new-account-modal",
    closeSelectors: ["#new-account-modal [data-new-account-modal-close]"]
});

let messages = {};
let userSettings = null;
let cachedBanks = [];
let cachedAccounts = [];
let dataLoaded = false;
let infoModalState = null;
let infoModalTrigger = null;
let editingBankId = null;
let editingAccountId = null;
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

    if (!text) {
        toastManager.clear();
        return;
    }

    if (element === listMessage) {
        toastManager.show(text, {type});
    }
}

function setModalFormMessage(container, element, text, type = "") {
    if (!container || !element) {
        return;
    }

    element.textContent = text;
    element.dataset.type = type;
    container.dataset.type = type || "error";
    container.hidden = !text;
}

function showPendingNotification() {
    let rawValue = "";
    try {
        rawValue = window.sessionStorage.getItem(BANKS_ACCOUNTS_NOTIFICATION_KEY) ?? "";
    } catch (error) {
        console.warn("Cannot access banks-accounts notification state", error);
        return;
    }

    if (!rawValue) {
        return;
    }

    try {
        window.sessionStorage.removeItem(BANKS_ACCOUNTS_NOTIFICATION_KEY);
    } catch (error) {
        console.warn("Cannot clear banks-accounts notification state", error);
    }

    try {
        const notification = JSON.parse(rawValue);
        const messageKey = typeof notification?.messageKey === "string" ? notification.messageKey : "";
        const type = typeof notification?.type === "string" ? notification.type : "";
        const text = messages[messageKey] ?? "";
        if (text) {
            setMessage(listMessage, text, type);
        }
    } catch (error) {
        console.warn("Cannot parse banks-accounts notification state", error);
    }
}

function setNewBankFormMessage(text, type = "") {
    setModalFormMessage(newBankFormMessageContainer, newBankFormMessage, text, type);
}

function setEditBankFormMessage(text, type = "") {
    setModalFormMessage(editBankFormMessageContainer, editBankFormMessage, text, type);
}

function resetEditBankForm() {
    if (!editBankModalForm || !editBankNameInput || !editBankSubmitButton) {
        return;
    }

    editingBankId = null;
    editBankModalForm.reset();
    setEditBankFormMessage("");
    editBankSubmitButton.disabled = false;
}

function resetNewBankForm() {
    if (!newBankModalForm || !newBankNameInput || !newBankSubmitButton) {
        return;
    }

    newBankModalForm.reset();
    setNewBankFormMessage("");
    newBankSubmitButton.disabled = false;
}

function setEditAccountFormMessage(text, type = "") {
    setModalFormMessage(editAccountFormMessageContainer, editAccountFormMessage, text, type);
}

function setNewAccountFormMessage(text, type = "") {
    setModalFormMessage(newAccountFormMessageContainer, newAccountFormMessage, text, type);
}

function renderAccountBankOptions(selectElement, selectedValue = "") {
    if (!selectElement) {
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = messages["accounts.form.bankPlaceholder"] ?? "";

    selectElement.replaceChildren(
        placeholder,
        ...cachedBanks.map((bank) => {
            const option = document.createElement("option");
            option.value = bank.name;
            option.textContent = bank.name;
            return option;
        })
    );
    selectElement.value = selectedValue;
}

function renderNewAccountBankOptions(selectedValue = "") {
    renderAccountBankOptions(newAccountBankSelect, selectedValue);
}

function renderEditAccountBankOptions(selectedValue = "") {
    renderAccountBankOptions(editAccountBankSelect, selectedValue);
}

function resetNewAccountForm() {
    if (!newAccountModalForm || !newAccountNameInput || !newAccountSubmitButton) {
        return;
    }

    newAccountModalForm.reset();
    renderNewAccountBankOptions();
    newAccountTypeSelect.value = "BANK_ACCOUNT";
    newAccountCurrencySelect.value = "PLN";
    newAccountStatusSelect.value = "ACTIVE";
    setNewAccountFormMessage("");
    newAccountSubmitButton.disabled = false;
}

function resetEditAccountForm() {
    if (!editAccountModalForm || !editAccountNameInput || !editAccountSubmitButton) {
        return;
    }

    editingAccountId = null;
    editAccountModalForm.reset();
    renderEditAccountBankOptions();
    editAccountTypeSelect.value = "BANK_ACCOUNT";
    editAccountCurrencySelect.value = "PLN";
    editAccountStatusSelect.value = "ACTIVE";
    setEditAccountFormMessage("");
    editAccountSubmitButton.disabled = false;
}

function openNewAccountModal({trigger, bankName = ""} = {}) {
    resetNewAccountForm();
    if (bankName) {
        renderNewAccountBankOptions(bankName);
    }
    newAccountModal.open({trigger});
}

function openEditBankModal({trigger, bank} = {}) {
    if (!bank || !editBankNameInput) {
        return;
    }

    resetEditBankForm();
    editingBankId = bank.id;
    editBankNameInput.value = bank.name ?? "";
    editBankModal.open({trigger});
}

function openEditAccountModal({trigger, account} = {}) {
    if (!account || !editAccountNameInput) {
        return;
    }

    resetEditAccountForm();
    editingAccountId = account.id;
    editAccountNameInput.value = account.accountName ?? "";
    renderEditAccountBankOptions(account.bankName ?? "");
    editAccountTypeSelect.value = account.accountTypeCode ?? "BANK_ACCOUNT";
    editAccountCurrencySelect.value = account.currencyCode ?? "PLN";
    editAccountStatusSelect.value = account.status ?? "ACTIVE";
    editAccountDescriptionInput.value = account.description ?? "";
    editAccountModal.open({trigger});
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
    MoneySnapshotUi.dismissTooltip?.(triggerElement);
    renderInfoModal();
    infoModal.hidden = false;
    infoModalCloseButton.focus();
}

function closeInfoModal() {
    infoModalState = null;
    infoModal.hidden = true;
    if (infoModalTrigger instanceof HTMLElement) {
        infoModalTrigger.dataset.suppressTooltipOnFocusOnce = "true";
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
    MoneySnapshotUi.setTooltip(newBankAction, messages["banks.actions.add"]);
    MoneySnapshotUi.setTooltip(newAccountAction, messages["accounts.actions.add"]);
    MoneySnapshotUi.setTooltip(refreshButton, messages["banks.actions.refresh"]);
    renderEditAccountBankOptions(editAccountBankSelect?.value ?? "");
    renderNewAccountBankOptions(newAccountBankSelect?.value ?? "");
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

async function createBank(name) {
    const response = await fetch("/api/banks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({name})
    });

    if (response.status === 409) {
        throw new Error(messages["banks.error.duplicate"]);
    }

    if (!response.ok) {
        throw new Error(messages["banks.error.create"]);
    }

    return response.json();
}

async function updateBank(id, name) {
    const response = await fetch(`/api/banks/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({name})
    });

    if (response.status === 404) {
        throw new Error(messages["banks.error.notFound"]);
    }

    if (response.status === 409) {
        throw new Error(messages["banks.error.duplicate"]);
    }

    if (!response.ok) {
        throw new Error(messages["banks.error.update"]);
    }

    return response.json();
}

function accountPayloadFromFields({
    nameInput,
    bankSelect,
    typeSelect,
    currencySelect,
    descriptionInput,
    statusSelect
}) {
    return {
        accountName: nameInput.value.trim(),
        bankName: bankSelect.value,
        accountTypeCode: typeSelect.value,
        currencyCode: currencySelect.value,
        description: descriptionInput.value.trim(),
        status: statusSelect.value
    };
}

function accountPayloadFromModal() {
    return accountPayloadFromFields({
        nameInput: newAccountNameInput,
        bankSelect: newAccountBankSelect,
        typeSelect: newAccountTypeSelect,
        currencySelect: newAccountCurrencySelect,
        descriptionInput: newAccountDescriptionInput,
        statusSelect: newAccountStatusSelect
    });
}

function editAccountPayloadFromModal() {
    return accountPayloadFromFields({
        nameInput: editAccountNameInput,
        bankSelect: editAccountBankSelect,
        typeSelect: editAccountTypeSelect,
        currencySelect: editAccountCurrencySelect,
        descriptionInput: editAccountDescriptionInput,
        statusSelect: editAccountStatusSelect
    });
}

async function createAccount(payload) {
    const response = await fetch("/api/accounts", {
        method: "POST",
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
        throw new Error(messages["accounts.error.create"]);
    }

    return response.json();
}

async function updateAccount(id, payload) {
    const response = await fetch(`/api/accounts/${encodeURIComponent(id)}`, {
        method: "PUT",
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
        throw new Error(messages["accounts.error.update"]);
    }

    return response.json();
}

function createAccountTable(accounts) {
    const wrapper = document.createElement("div");
    wrapper.className = "banks-accounts-nested-wrap";

    const nestedTable = document.createElement("table");
    nestedTable.className = "accounts-table banks-accounts-nested-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    [
        messages["accounts.table.name"] ?? "",
        messages["accounts.table.accountType"] ?? "",
        messages["accounts.table.currency"] ?? "",
        messages["accounts.table.status"] ?? "",
        messages["accounts.table.actions"] ?? ""
    ].forEach((value) => {
        const headerCell = document.createElement("th");
        headerCell.textContent = value;
        headerRow.append(headerCell);
    });
    thead.append(headerRow);

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
            const editButton = document.createElement("a");
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

            editButton.className = "icon-button";
            editButton.href = `/accounts/${encodeURIComponent(account.id)}/edit.html?returnTo=${encodeURIComponent(`/banks-accounts.html?expandBank=${account.bankId}`)}`;
            editButton.setAttribute("aria-label", messages["accounts.actions.edit"]);
            MoneySnapshotUi.setTooltip(editButton, messages["accounts.actions.edit"]);
            editButton.append(MoneySnapshotUi.createEditIcon());
            editButton.addEventListener("click", (event) => {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                    return;
                }

                event.preventDefault();
                openEditAccountModal({trigger: editButton, account});
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
        const addAccountButton = document.createElement("a");
        const infoButton = document.createElement("button");
        const editButton = document.createElement("a");
        const deleteButton = document.createElement("button");
        actions.className = "row-actions";

        addAccountButton.className = "icon-button";
        addAccountButton.href = `/accounts/new.html?bank=${encodeURIComponent(bank.name)}&returnTo=${encodeURIComponent(`/banks-accounts.html?expandBank=${bank.id}`)}`;
        addAccountButton.setAttribute("aria-label", messages["accounts.actions.add"]);
        MoneySnapshotUi.setTooltip(addAccountButton, messages["accounts.actions.add"]);
        addAccountButton.append(MoneySnapshotUi.createAddIcon());
        addAccountButton.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            event.preventDefault();
            openNewAccountModal({trigger: addAccountButton, bankName: bank.name});
        });

        infoButton.type = "button";
        infoButton.className = "icon-button";
        infoButton.setAttribute("aria-label", messages["banksAccounts.actions.info"]);
        MoneySnapshotUi.setTooltip(infoButton, messages["banksAccounts.actions.info"]);
        infoButton.append(MoneySnapshotUi.createInfoIcon());
        infoButton.addEventListener("click", () => {
            openInfoModal("bank", bank, bankAccounts.length, infoButton);
        });

        editButton.className = "icon-button";
        editButton.href = `/banks/${encodeURIComponent(bank.id)}/edit.html?returnTo=${encodeURIComponent(`/banks-accounts.html?expandBank=${bank.id}`)}`;
        editButton.setAttribute("aria-label", messages["banks.actions.edit"]);
        MoneySnapshotUi.setTooltip(editButton, messages["banks.actions.edit"]);
        editButton.append(MoneySnapshotUi.createEditIcon());
        editButton.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            event.preventDefault();
            openEditBankModal({trigger: editButton, bank});
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
    renderEditAccountBankOptions(editAccountBankSelect?.value ?? "");
    renderNewAccountBankOptions(newAccountBankSelect?.value ?? "");
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

if (newBankAction && newBankModalForm && newBankNameInput && newBankSubmitButton) {
    newBankAction.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        event.preventDefault();
        resetNewBankForm();
        newBankModal.open({trigger: newBankAction});
    });

    newBankModalForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = newBankNameInput.value.trim();
        if (!name) {
            setNewBankFormMessage(messages["banks.form.requiredName"], "error");
            newBankNameInput.focus();
            return;
        }

        newBankSubmitButton.disabled = true;
        setNewBankFormMessage("");

        try {
            const bank = await createBank(name);
            if (bank?.id) {
                expandedBankIds.add(bank.id);
            }
            newBankModal.close();
            setMessage(listMessage, messages["banks.form.success"], "success");
            await loadAll();
        } catch (error) {
            setNewBankFormMessage(error.message, "error");
            newBankSubmitButton.disabled = false;
            newBankNameInput.focus();
        }
    });
}

if (editBankModalForm && editBankNameInput && editBankSubmitButton) {
    editBankModalForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = editBankNameInput.value.trim();
        if (!name) {
            setEditBankFormMessage(messages["banks.form.requiredName"], "error");
            editBankNameInput.focus();
            return;
        }

        if (!editingBankId) {
            setEditBankFormMessage(messages["banks.error.notFound"], "error");
            return;
        }

        editBankSubmitButton.disabled = true;
        setEditBankFormMessage("");

        try {
            const bank = await updateBank(editingBankId, name);
            if (bank?.id) {
                expandedBankIds.add(bank.id);
            }
            editBankModal.close();
            setMessage(listMessage, messages["banks.form.success"], "success");
            await loadAll();
        } catch (error) {
            setEditBankFormMessage(error.message, "error");
            editBankSubmitButton.disabled = false;
            editBankNameInput.focus();
        }
    });
}

if (
    editAccountModalForm &&
    editAccountNameInput &&
    editAccountBankSelect &&
    editAccountTypeSelect &&
    editAccountCurrencySelect &&
    editAccountStatusSelect &&
    editAccountDescriptionInput &&
    editAccountSubmitButton
) {
    editAccountModalForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = editAccountPayloadFromModal();
        if (!payload.accountName || !payload.bankName || !payload.accountTypeCode || !payload.currencyCode || !payload.status) {
            setEditAccountFormMessage(messages["accounts.form.required"], "error");
            editAccountNameInput.focus();
            return;
        }

        if (!editingAccountId) {
            setEditAccountFormMessage(messages["accounts.error.notFound"], "error");
            return;
        }

        editAccountSubmitButton.disabled = true;
        setEditAccountFormMessage("");

        try {
            const account = await updateAccount(editingAccountId, payload);
            if (account?.bankId) {
                expandedBankIds.add(account.bankId);
            }
            editAccountModal.close();
            setMessage(listMessage, messages["accounts.form.success"], "success");
            await loadAll();
        } catch (error) {
            setEditAccountFormMessage(error.message, "error");
            editAccountSubmitButton.disabled = false;
            editAccountNameInput.focus();
        }
    });
}

if (
    newAccountAction &&
    newAccountModalForm &&
    newAccountNameInput &&
    newAccountBankSelect &&
    newAccountTypeSelect &&
    newAccountCurrencySelect &&
    newAccountStatusSelect &&
    newAccountDescriptionInput &&
    newAccountSubmitButton
) {
    newAccountAction.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        event.preventDefault();
        openNewAccountModal({trigger: newAccountAction});
    });

    newAccountModalForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = accountPayloadFromModal();
        if (!payload.accountName || !payload.bankName || !payload.accountTypeCode || !payload.currencyCode || !payload.status) {
            setNewAccountFormMessage(messages["accounts.form.required"], "error");
            newAccountNameInput.focus();
            return;
        }

        newAccountSubmitButton.disabled = true;
        setNewAccountFormMessage("");

        try {
            const account = await createAccount(payload);
            if (account?.bankId) {
                expandedBankIds.add(account.bankId);
            }
            newAccountModal.close();
            setMessage(listMessage, messages["accounts.form.success"], "success");
            await loadAll();
        } catch (error) {
            setNewAccountFormMessage(error.message, "error");
            newAccountSubmitButton.disabled = false;
            newAccountNameInput.focus();
        }
    });
}

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
        .then(() => {
            showPendingNotification();
        })
        .then(loadAll)
        .catch((error) => {
            renderEmpty(error.message);
        });
