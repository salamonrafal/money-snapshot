const bankForm = document.querySelector("#bank-form");
const bankNameInput = document.querySelector("#bank-name");
const formMessage = document.querySelector("#bank-form-message");
const tableBody = document.querySelector("#banks-table-body");
const refreshButton = document.querySelector("#refresh-banks");
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
    formMessage.textContent = text;
    formMessage.dataset.type = type;
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
        const deleteButton = document.createElement("button");
        actions.className = "row-actions";
        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.title = messages["banks.actions.delete"];
        deleteButton.setAttribute("aria-label", messages["banks.actions.delete"]);
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteModal.open(bank, bank.name);
        });
        actions.append(deleteButton);
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

bankForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = bankNameInput.value.trim();
    if (!name) {
        setMessage(messages["banks.form.requiredName"], "error");
        return;
    }

    bankForm.querySelector("button[type='submit']").disabled = true;
    setMessage("");

    try {
        await createBank(name);
        bankForm.reset();
        setMessage(messages["banks.form.success"], "success");
        await loadBanks();
    } catch (error) {
        setMessage(error.message, "error");
    } finally {
        bankForm.querySelector("button[type='submit']").disabled = false;
        bankNameInput.focus();
    }
});

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
