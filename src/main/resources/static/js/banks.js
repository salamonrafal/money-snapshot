const tableBody = document.querySelector("#banks-table-body");
const refreshButton = document.querySelector("#refresh-banks");
const listMessage = document.querySelector("#banks-list-message");
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-bank-modal",
    subjectSelector: "#delete-bank-name",
    confirmSelector: "#confirm-delete-bank",
    cancelSelector: "#cancel-delete-bank"
});

let currentLanguage = "pl";
let messages = {};
let cachedBanks = [];
let banksLoaded = false;
let userSettings = null;

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    document.title = `${messages["banks.heading.title"]} | ${messages["app.name"]}`;
    if (banksLoaded) {
        renderBanks(cachedBanks);
    }
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    return MoneySnapshotUi.formatDateTimeValue(value, userSettings);
}

function setMessage(text, type = "") {
    if (!listMessage) {
        return;
    }

    listMessage.textContent = text;
    listMessage.dataset.type = type;
}

function renderBanks(banks) {
    cachedBanks = banks;
    banksLoaded = true;
    if (banks.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = messages["banks.empty"] ?? "";
        row.append(cell);
        tableBody.replaceChildren(row);
        return;
    }

    tableBody.replaceChildren(...banks.map((bank) => {
        const row = document.createElement("tr");
        [
            bank.name,
            bank.normalizedName,
            formatDateTime(bank.createdAt),
            formatDateTime(bank.updatedAt)
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
        editButton.setAttribute("aria-label", messages["banks.actions.edit"]);
        MoneySnapshotUi.setTooltip(editButton, messages["banks.actions.edit"]);
        editButton.append(MoneySnapshotUi.createEditIcon());
        editButton.addEventListener("click", () => {
            window.location.href = `/banks/${encodeURIComponent(bank.id)}/edit.html`;
        });

        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.setAttribute("aria-label", messages["banks.actions.delete"]);
        MoneySnapshotUi.setTooltip(deleteButton, messages["banks.actions.delete"]);
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteModal.open(bank, bank.name);
        });
        actions.append(editButton, deleteButton);
        actionsCell.append(actions);
        row.append(actionsCell);

        return row;
    }));
}

async function loadBanks() {
    const response = await fetch("/api/banks");
    if (!response.ok) {
        throw new Error(messages["banks.error.load"]);
    }

    renderBanks(await response.json());
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

refreshButton.addEventListener("click", () => {
    loadBanks().catch((error) => {
        setMessage(error.message, "error");
    });
});

deleteModal.confirmButton.addEventListener("click", async () => {
    const selectedBank = deleteModal.getSelectedItem();
    if (!selectedBank) {
        return;
    }

    deleteModal.confirmButton.disabled = true;
    setMessage("");

    try {
        await deleteBank(selectedBank.id);
        deleteModal.close();
        setMessage(messages["banks.delete.success"], "success");
        await loadBanks();
    } catch (error) {
        deleteModal.close();
        setMessage(error.message, "error");
    } finally {
        deleteModal.confirmButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/banks/messages",
    onLanguageChange: ({language, messages}) => {
        handleLanguageChange(language, messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadBanks)
        .catch((error) => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = error.message;
    row.append(cell);
    tableBody.replaceChildren(row);
});
