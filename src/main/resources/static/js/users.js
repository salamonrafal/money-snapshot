const tableBody = document.querySelector("#users-table-body");
const listMessage = document.querySelector("#users-list-message");
const refreshButton = document.querySelector("#refresh-users");
const newUserAction = document.querySelector("#new-user-action");
const newUserForm = document.querySelector("#new-user-form");
const newUserEmailInput = document.querySelector("#new-user-email");
const newUserFirstNameInput = document.querySelector("#new-user-first-name");
const newUserLastNameInput = document.querySelector("#new-user-last-name");
const newUserDescriptionInput = document.querySelector("#new-user-description");
const newUserRoleSelect = document.querySelector("#new-user-role");
const newUserStatusSelect = document.querySelector("#new-user-status");
const newUserPasswordInput = document.querySelector("#new-user-password");
const newUserSubmitButton = document.querySelector("#new-user-submit");
const editUserForm = document.querySelector("#edit-user-form");
const editUserEmailInput = document.querySelector("#edit-user-email");
const editUserFirstNameInput = document.querySelector("#edit-user-first-name");
const editUserLastNameInput = document.querySelector("#edit-user-last-name");
const editUserDescriptionInput = document.querySelector("#edit-user-description");
const editUserRoleSelect = document.querySelector("#edit-user-role");
const editUserStatusSelect = document.querySelector("#edit-user-status");
const editUserPasswordInput = document.querySelector("#edit-user-password");
const editUserSubmitButton = document.querySelector("#edit-user-submit");
const toastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});
const USERS_NOTIFICATION_KEY = "money-snapshot-users-notification";
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-user-modal",
    subjectSelector: "#delete-user-name",
    confirmSelector: "#confirm-delete-user",
    cancelSelector: "#cancel-delete-user"
});
const newUserModal = MoneySnapshotUi.createModal({
    modalSelector: "#new-user-modal",
    closeSelectors: ["#new-user-modal [data-new-user-modal-close]"]
});
const editUserModal = MoneySnapshotUi.createModal({
    modalSelector: "#edit-user-modal",
    closeSelectors: ["#edit-user-modal [data-edit-user-modal-close]"]
});

let messages = {};
let roles = [];
let cachedUsers = [];
let usersLoaded = false;
let userSettings = null;
let editingUserId = null;
const newUserFormControls = [
    newUserEmailInput,
    newUserFirstNameInput,
    newUserLastNameInput,
    newUserRoleSelect,
    newUserStatusSelect,
    newUserPasswordInput
].filter(Boolean);
const editUserFormControls = [
    editUserEmailInput,
    editUserFirstNameInput,
    editUserLastNameInput,
    editUserRoleSelect,
    editUserStatusSelect,
    editUserPasswordInput
].filter(Boolean);

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    document.title = `${messages["users.heading.title"]} | ${messages["app.name"]}`;
    renderRoleOptions(newUserRoleSelect, newUserRoleSelect.value);
    renderRoleOptions(editUserRoleSelect, editUserRoleSelect.value);
    if (usersLoaded) {
        renderUsers(cachedUsers);
    }
}

function showToast(text, type = "") {
    if (!text) {
        return;
    }

    toastManager.clear();
    toastManager.show(text, {type});
}

function setListMessage(text, type = "") {
    if (!listMessage) {
        return;
    }

    listMessage.textContent = text;
    listMessage.dataset.type = type;
}

function showPendingNotification() {
    let rawValue = "";

    try {
        rawValue = window.sessionStorage.getItem(USERS_NOTIFICATION_KEY) ?? "";
    } catch (error) {
        console.warn("Cannot access users notification state", error);
        return;
    }

    if (!rawValue) {
        return;
    }

    try {
        window.sessionStorage.removeItem(USERS_NOTIFICATION_KEY);
    } catch (error) {
        console.warn("Cannot clear users notification state", error);
    }

    try {
        const notification = JSON.parse(rawValue);
        const messageKey = typeof notification?.messageKey === "string" ? notification.messageKey : "";
        const type = typeof notification?.type === "string" ? notification.type : "";
        const text = messages[messageKey] ?? "";
        if (text) {
            showToast(text, type);
        }
    } catch (error) {
        console.warn("Cannot parse users notification state", error);
    }
}

function persistUsersNotification(messageKey, type = "success") {
    try {
        window.sessionStorage.setItem(USERS_NOTIFICATION_KEY, JSON.stringify({
            messageKey,
            type
        }));
    } catch (error) {
        console.warn("Cannot save users notification state", error);
    }
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

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function renderRoleOptions(selectElement, selectedValue = "") {
    if (!selectElement) {
        return;
    }

    selectElement.replaceChildren(...roles.map((role) => {
        const option = document.createElement("option");
        option.value = role.id;
        option.textContent = role.name;
        return option;
    }));

    if (selectedValue) {
        selectElement.value = selectedValue;
        return;
    }

    const defaultValue = roles[0]?.id ?? "";
    if (defaultValue) {
        selectElement.value = defaultValue;
    }
}

function clearFieldHighlights(inputs) {
    inputs.forEach((input) => input.removeAttribute("aria-invalid"));
}

function highlightField(input) {
    input?.setAttribute("aria-invalid", "true");
}

function focusFirstHighlightedField(inputs) {
    inputs.find((input) => input.getAttribute("aria-invalid") === "true")?.focus();
}

function validateUserForm(fieldMap, {requirePassword = false} = {}) {
    let isValid = true;

    if (!fieldMap.email.value.trim() || fieldMap.email.validity.typeMismatch) {
        highlightField(fieldMap.email);
        isValid = false;
    }

    if (!fieldMap.firstName.value.trim()) {
        highlightField(fieldMap.firstName);
        isValid = false;
    }

    if (!fieldMap.lastName.value.trim()) {
        highlightField(fieldMap.lastName);
        isValid = false;
    }

    if (!fieldMap.role.value) {
        highlightField(fieldMap.role);
        isValid = false;
    }

    if (!fieldMap.status.value) {
        highlightField(fieldMap.status);
        isValid = false;
    }

    if (requirePassword && !fieldMap.password.value) {
        highlightField(fieldMap.password);
        isValid = false;
    }

    return isValid;
}

function resetNewUserForm() {
    if (!newUserForm) {
        return;
    }

    newUserForm.reset();
    renderRoleOptions(newUserRoleSelect);
    newUserStatusSelect.value = "ACTIVE";
    newUserPasswordInput.required = true;
    newUserSubmitButton.disabled = false;
    clearFieldHighlights(newUserFormControls);
}

function resetEditUserForm() {
    if (!editUserForm) {
        return;
    }

    editingUserId = null;
    editUserForm.reset();
    renderRoleOptions(editUserRoleSelect);
    editUserStatusSelect.value = "ACTIVE";
    editUserPasswordInput.required = false;
    editUserSubmitButton.disabled = false;
    clearFieldHighlights(editUserFormControls);
}

function fillEditUserForm(user) {
    editingUserId = user.id;
    editUserEmailInput.value = user.email ?? "";
    editUserFirstNameInput.value = user.firstName ?? "";
    editUserLastNameInput.value = user.lastName ?? "";
    editUserDescriptionInput.value = user.description ?? "";
    renderRoleOptions(editUserRoleSelect, user.roleId);
    editUserStatusSelect.value = user.status ?? "ACTIVE";
    editUserPasswordInput.value = "";
    editUserPasswordInput.required = false;
}

function shouldOpenModalFromClick(event) {
    return event.button === 0
        && !event.defaultPrevented
        && !event.metaKey
        && !event.ctrlKey
        && !event.shiftKey
        && !event.altKey;
}

function buildPayload({
    emailInput,
    firstNameInput,
    lastNameInput,
    descriptionInput,
    roleSelect,
    statusSelect,
    passwordInput
}) {
    return {
        email: emailInput.value.trim(),
        firstName: firstNameInput.value.trim(),
        lastName: lastNameInput.value.trim(),
        description: descriptionInput.value.trim() || null,
        roleId: roleSelect.value,
        status: statusSelect.value,
        password: passwordInput.value || null
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

function applyServerFieldHighlights(fieldMap, fieldErrors = {}) {
    if (fieldErrors.email) {
        highlightField(fieldMap.email);
    }
    if (fieldErrors.firstName) {
        highlightField(fieldMap.firstName);
    }
    if (fieldErrors.lastName) {
        highlightField(fieldMap.lastName);
    }
    if (fieldErrors.roleId) {
        highlightField(fieldMap.role);
    }
    if (fieldErrors.status) {
        highlightField(fieldMap.status);
    }
    if (fieldErrors.password) {
        highlightField(fieldMap.password);
    }
}

function validatePayload(payload, {requirePassword = false} = {}) {
    if (!payload.email || !payload.firstName || !payload.lastName || !payload.roleId || !payload.status) {
        throw new Error(messages["users.form.required"]);
    }

    if (requirePassword && !payload.password) {
        throw new Error(messages["users.form.requiredPassword"]);
    }
}

function createEditAction(user) {
    const editLink = document.createElement("a");
    editLink.className = "icon-button";
    editLink.href = `/users/${encodeURIComponent(user.id)}/edit.html`;
    editLink.setAttribute("aria-label", messages["users.actions.edit"]);
    MoneySnapshotUi.setTooltip(editLink, messages["users.actions.edit"]);
    editLink.append(MoneySnapshotUi.createEditIcon());
    editLink.addEventListener("click", async (event) => {
        if (!shouldOpenModalFromClick(event)) {
            return;
        }

        event.preventDefault();
        editLink.setAttribute("aria-disabled", "true");

        try {
            const fullUser = await loadUser(user.id);
            resetEditUserForm();
            fillEditUserForm(fullUser);
            editUserModal.open({trigger: editLink});
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            editLink.removeAttribute("aria-disabled");
        }
    });

    return editLink;
}

function renderUsers(users) {
    cachedUsers = users;
    usersLoaded = true;

    if (users.length === 0) {
        renderEmpty(messages["users.empty"] ?? "");
        return;
    }

    tableBody.replaceChildren(...users.map((user) => {
        const row = document.createElement("tr");
        [
            user.email,
            `${user.firstName} ${user.lastName}`.trim(),
            user.roleName,
            statusLabel(user.status),
            formatDateTime(user.updatedAt)
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value || "-";
            row.append(cell);
        });

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        const deleteButton = document.createElement("button");
        actions.className = "row-actions";

        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.setAttribute("aria-label", messages["users.actions.delete"]);
        MoneySnapshotUi.setTooltip(deleteButton, messages["users.actions.delete"]);
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteModal.open(user, user.email);
        });

        actions.append(createEditAction(user), deleteButton);
        actionsCell.append(actions);
        row.append(actionsCell);
        return row;
    }));
}

async function loadRoles() {
    const response = await fetch("/api/roles");
    if (!response.ok) {
        throw new Error(messages["users.error.loadRoles"]);
    }

    roles = await response.json();
    renderRoleOptions(newUserRoleSelect);
    renderRoleOptions(editUserRoleSelect);
}

async function loadUsers() {
    const response = await fetch("/api/users");
    if (!response.ok) {
        throw new Error(messages["users.error.load"]);
    }

    renderUsers(await response.json());
}

async function loadUser(userId) {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`);
    if (response.status === 404) {
        throw new Error(messages["users.error.notFound"]);
    }
    if (!response.ok) {
        throw new Error(messages["users.error.load"]);
    }

    return response.json();
}

async function saveUser(userId, payload) {
    const isEdit = Boolean(userId);
    const response = await fetch(isEdit ? `/api/users/${encodeURIComponent(userId)}` : "/api/users", {
        method: isEdit ? "PUT" : "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 404) {
        throw new Error(messages["users.error.notFound"]);
    }
    if (response.status === 409) {
        throw new Error(messages["users.error.duplicate"]);
    }
    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(
                errorPayload.fieldErrors.password && !isEdit
                    ? messages["users.form.requiredPassword"]
                    : messages["users.form.required"]
            );
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        throw new Error(messages["users.error.invalid"]);
    }
    if (!response.ok) {
        throw new Error(messages[isEdit ? "users.error.update" : "users.error.create"]);
    }

    return response.json();
}

async function deleteUser(userId) {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: "DELETE"
    });

    if (response.status === 404) {
        throw new Error(messages["users.error.notFound"]);
    }
    if (response.status === 400) {
        throw new Error(messages["users.error.deleteSelf"]);
    }
    if (!response.ok) {
        throw new Error(messages["users.error.delete"]);
    }
}

if (newUserAction) {
    newUserAction.addEventListener("click", (event) => {
        if (!shouldOpenModalFromClick(event)) {
            return;
        }

        event.preventDefault();
        resetNewUserForm();
        newUserModal.open({trigger: newUserAction});
    });
}

if (refreshButton) {
    refreshButton.addEventListener("click", () => {
        setListMessage("");
        loadUsers().catch((error) => {
            renderEmpty(error.message);
        });
    });
}

if (newUserForm) {
    newUserForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFieldHighlights(newUserFormControls);
        const payload = buildPayload({
            emailInput: newUserEmailInput,
            firstNameInput: newUserFirstNameInput,
            lastNameInput: newUserLastNameInput,
            descriptionInput: newUserDescriptionInput,
            roleSelect: newUserRoleSelect,
            statusSelect: newUserStatusSelect,
            passwordInput: newUserPasswordInput
        });

        if (!newUserForm.reportValidity() || !validateUserForm({
            email: newUserEmailInput,
            firstName: newUserFirstNameInput,
            lastName: newUserLastNameInput,
            role: newUserRoleSelect,
            status: newUserStatusSelect,
            password: newUserPasswordInput
        }, {requirePassword: true})) {
            showToast(!newUserPasswordInput.value ? messages["users.form.requiredPassword"] : messages["users.form.required"], "error");
            focusFirstHighlightedField(newUserFormControls);
            return;
        }

        newUserSubmitButton.disabled = true;

        try {
            await saveUser(null, payload);
            newUserModal.close();
            resetNewUserForm();
            await loadUsers();
            showToast(messages["users.form.success"], "success");
        } catch (error) {
            if (error.fieldErrors) {
                applyServerFieldHighlights({
                    email: newUserEmailInput,
                    firstName: newUserFirstNameInput,
                    lastName: newUserLastNameInput,
                    role: newUserRoleSelect,
                    status: newUserStatusSelect,
                    password: newUserPasswordInput
                }, error.fieldErrors);
                focusFirstHighlightedField(newUserFormControls);
            } else if (error.message === messages["users.error.duplicate"]) {
                highlightField(newUserEmailInput);
                focusFirstHighlightedField(newUserFormControls);
            }
            showToast(error.message, "error");
        } finally {
            newUserSubmitButton.disabled = false;
        }
    });
}

if (editUserForm) {
    editUserForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearFieldHighlights(editUserFormControls);
        const payload = buildPayload({
            emailInput: editUserEmailInput,
            firstNameInput: editUserFirstNameInput,
            lastNameInput: editUserLastNameInput,
            descriptionInput: editUserDescriptionInput,
            roleSelect: editUserRoleSelect,
            statusSelect: editUserStatusSelect,
            passwordInput: editUserPasswordInput
        });

        if (!editUserForm.reportValidity() || !validateUserForm({
            email: editUserEmailInput,
            firstName: editUserFirstNameInput,
            lastName: editUserLastNameInput,
            role: editUserRoleSelect,
            status: editUserStatusSelect,
            password: editUserPasswordInput
        })) {
            showToast(messages["users.form.required"], "error");
            focusFirstHighlightedField(editUserFormControls);
            return;
        }

        editUserSubmitButton.disabled = true;

        try {
            await saveUser(editingUserId, payload);
            editUserModal.close();
            resetEditUserForm();
            await loadUsers();
            showToast(messages["users.form.success"], "success");
        } catch (error) {
            if (error.fieldErrors) {
                applyServerFieldHighlights({
                    email: editUserEmailInput,
                    firstName: editUserFirstNameInput,
                    lastName: editUserLastNameInput,
                    role: editUserRoleSelect,
                    status: editUserStatusSelect,
                    password: editUserPasswordInput
                }, error.fieldErrors);
                focusFirstHighlightedField(editUserFormControls);
            } else if (error.message === messages["users.error.duplicate"]) {
                highlightField(editUserEmailInput);
                focusFirstHighlightedField(editUserFormControls);
            }
            showToast(error.message, "error");
        } finally {
            editUserSubmitButton.disabled = false;
        }
    });
}

[
    ...newUserFormControls,
    ...editUserFormControls
].filter(Boolean).forEach((input) => {
    const eventName = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, () => {
        input.removeAttribute("aria-invalid");
    });
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
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
    .then(() => MoneySnapshotUi.loadUserSettings())
    .then((settings) => {
        userSettings = settings;
    })
    .then(loadRoles)
    .then(() => {
        resetNewUserForm();
        resetEditUserForm();
        showPendingNotification();
    })
    .then(loadUsers)
    .catch((error) => {
        renderEmpty(error.message);
        showToast(error.message, "error");
    });
