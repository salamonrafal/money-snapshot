const tableBody = document.querySelector("#users-table-body");
const refreshButton = document.querySelector("#refresh-users");
const listMessage = document.querySelector("#users-list-message");
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-user-modal",
    subjectSelector: "#delete-user-name",
    confirmSelector: "#confirm-delete-user",
    cancelSelector: "#cancel-delete-user"
});

let currentLanguage = "pl";
let messages = {};
let cachedUsers = [];
let userSettings = null;

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    document.title = `${messages["users.heading.title"]} | ${messages["app.name"]}`;
    renderUsers(cachedUsers);
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    return MoneySnapshotUi.formatDateTimeValue(value, userSettings);
}

function statusLabel(status) {
    return messages[`users.status.${status}`] ?? status;
}

function setListMessage(text, type = "") {
    listMessage.textContent = text;
    listMessage.dataset.type = type;
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function renderUsers(users) {
    cachedUsers = users;
    if (!messages["users.empty"]) {
        return;
    }
    if (users.length === 0) {
        renderEmpty(messages["users.empty"]);
        return;
    }

    tableBody.replaceChildren(...users.map((user) => {
        const row = document.createElement("tr");
        [
            user.email,
            `${user.firstName} ${user.lastName}`,
            user.roleName,
            statusLabel(user.status),
            formatDateTime(user.updatedAt)
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
        editButton.setAttribute("aria-label", messages["users.actions.edit"]);
        MoneySnapshotUi.setTooltip(editButton, messages["users.actions.edit"]);
        editButton.append(MoneySnapshotUi.createEditIcon());
        editButton.addEventListener("click", () => {
            window.location.href = `/users/${encodeURIComponent(user.id)}/edit.html`;
        });

        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.setAttribute("aria-label", messages["users.actions.delete"]);
        MoneySnapshotUi.setTooltip(deleteButton, messages["users.actions.delete"]);
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteModal.open(user, user.email);
        });

        actions.append(editButton, deleteButton);
        actionsCell.append(actions);
        row.append(actionsCell);
        return row;
    }));
}

async function loadUsers() {
    const response = await fetch("/api/users");
    if (!response.ok) {
        throw new Error(messages["users.error.load"]);
    }

    renderUsers(await response.json());
}

async function deleteUser(id) {
    const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });

    if (response.status === 400) {
        throw new Error(messages["users.error.deleteSelf"]);
    }
    if (response.status === 404) {
        throw new Error(messages["users.error.notFound"]);
    }
    if (!response.ok) {
        throw new Error(messages["users.error.delete"]);
    }
}

refreshButton.addEventListener("click", () => {
    setListMessage("");
    loadUsers().catch((error) => renderEmpty(error.message));
});

deleteModal.confirmButton.addEventListener("click", async () => {
    const selectedUser = deleteModal.getSelectedItem();
    if (!selectedUser) {
        return;
    }

    deleteModal.confirmButton.disabled = true;
    setListMessage("");
    try {
        await deleteUser(selectedUser.id);
        deleteModal.close();
        setListMessage(messages["users.delete.success"], "success");
        await loadUsers();
    } catch (error) {
        deleteModal.close();
        setListMessage(error.message, "error");
    } finally {
        deleteModal.confirmButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/users/messages",
    onLanguageChange: ({language, messages}) => {
        handleLanguageChange(language, messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadUsers)
        .catch((error) => {
            renderEmpty(error.message);
        });
