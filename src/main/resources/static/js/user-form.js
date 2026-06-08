const userId = document.body.dataset.userId || null;
const userForm = document.querySelector("#user-form");
const pageTitle = document.querySelector("#user-form-page-title");
const emailInput = document.querySelector("#user-email");
const firstNameInput = document.querySelector("#user-first-name");
const lastNameInput = document.querySelector("#user-last-name");
const descriptionInput = document.querySelector("#user-description");
const roleSelect = document.querySelector("#user-role");
const statusSelect = document.querySelector("#user-status");
const passwordInput = document.querySelector("#user-password");
const passwordRequiredMark = document.querySelector("#user-password-required-mark");
const saveButton = document.querySelector("#save-user");
const toastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});
const USERS_NOTIFICATION_KEY = "money-snapshot-users-notification";

let messages = {};
let roles = [];
const formControls = [
    emailInput,
    firstNameInput,
    lastNameInput,
    roleSelect,
    statusSelect,
    passwordInput
].filter(Boolean);

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    const title = userId ? messages["users.form.editTitle"] : messages["users.form.title"];
    document.title = `${title} | ${messages["app.name"]}`;
    pageTitle.textContent = title;
    saveButton.textContent = userId ? messages["users.form.update"] : messages["users.form.submit"];
    renderRoles();
}

function showToast(text, type = "") {
    if (!text) {
        return;
    }

    toastManager.clear();
    toastManager.show(text, {type});
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

function renderRoles() {
    roleSelect.replaceChildren(...roles.map((role) => {
        const option = document.createElement("option");
        option.value = role.id;
        option.textContent = role.name;
        return option;
    }));
}

function fillForm(user) {
    emailInput.value = user.email;
    firstNameInput.value = user.firstName;
    lastNameInput.value = user.lastName;
    descriptionInput.value = user.description ?? "";
    roleSelect.value = user.roleId;
    statusSelect.value = user.status;
    passwordInput.value = "";
}

function clearFieldHighlights() {
    formControls.forEach((input) => input.removeAttribute("aria-invalid"));
}

function highlightField(input) {
    input?.setAttribute("aria-invalid", "true");
}

function focusFirstHighlightedField() {
    formControls.find((input) => input.getAttribute("aria-invalid") === "true")?.focus();
}

function validateTrimmedFields() {
    let isValid = true;

    if (!emailInput.value.trim() || emailInput.validity.typeMismatch) {
        highlightField(emailInput);
        isValid = false;
    }

    if (!firstNameInput.value.trim()) {
        highlightField(firstNameInput);
        isValid = false;
    }

    if (!lastNameInput.value.trim()) {
        highlightField(lastNameInput);
        isValid = false;
    }

    if (!roleSelect.value) {
        highlightField(roleSelect);
        isValid = false;
    }

    if (!statusSelect.value) {
        highlightField(statusSelect);
        isValid = false;
    }

    if (!userId && !passwordInput.value) {
        highlightField(passwordInput);
        isValid = false;
    }

    return isValid;
}

async function loadRoles() {
    const response = await fetch("/api/roles");
    if (!response.ok) {
        throw new Error(messages["users.error.loadRoles"]);
    }

    roles = await response.json();
    renderRoles();
}

async function loadUser() {
    if (!userId) {
        passwordInput.required = true;
        if (passwordRequiredMark) {
            passwordRequiredMark.hidden = false;
        }
        statusSelect.value = "ACTIVE";
        return;
    }

    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`);
    if (response.status === 404) {
        throw new Error(messages["users.error.notFound"]);
    }
    if (!response.ok) {
        throw new Error(messages["users.error.load"]);
    }

    fillForm(await response.json());
}

function buildPayload() {
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

function applyServerFieldHighlights(fieldErrors = {}) {
    if (fieldErrors.email) {
        highlightField(emailInput);
    }
    if (fieldErrors.firstName) {
        highlightField(firstNameInput);
    }
    if (fieldErrors.lastName) {
        highlightField(lastNameInput);
    }
    if (fieldErrors.roleId) {
        highlightField(roleSelect);
    }
    if (fieldErrors.status) {
        highlightField(statusSelect);
    }
    if (fieldErrors.password) {
        highlightField(passwordInput);
    }
}

async function saveUser(payload) {
    const response = await fetch(userId ? `/api/users/${encodeURIComponent(userId)}` : "/api/users", {
        method: userId ? "PUT" : "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 409) {
        throw new Error(messages["users.error.duplicate"]);
    }
    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(
                errorPayload.fieldErrors.password && !userId
                    ? messages["users.form.requiredPassword"]
                    : messages["users.form.required"]
            );
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        throw new Error(messages["users.error.invalid"]);
    }
    if (!response.ok) {
        throw new Error(userId ? messages["users.error.update"] : messages["users.error.create"]);
    }
}

userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldHighlights();
    if (!userForm.reportValidity() || !validateTrimmedFields()) {
        showToast(!passwordInput.value && !userId ? messages["users.form.requiredPassword"] : messages["users.form.required"], "error");
        focusFirstHighlightedField();
        return;
    }

    saveButton.disabled = true;
    try {
        await saveUser(buildPayload());
        persistUsersNotification("users.form.success", "success");
        window.location.href = "/users.html";
    } catch (error) {
        if (error.fieldErrors) {
            applyServerFieldHighlights(error.fieldErrors);
            focusFirstHighlightedField();
        } else if (error.message === messages["users.error.duplicate"]) {
            highlightField(emailInput);
            focusFirstHighlightedField();
        }
        showToast(error.message, "error");
        saveButton.disabled = false;
    }
});

[
    emailInput,
    firstNameInput,
    lastNameInput,
    roleSelect,
    statusSelect,
    passwordInput
].filter(Boolean).forEach((input) => {
    const eventName = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, () => {
        input.removeAttribute("aria-invalid");
    });
});

MoneySnapshotI18n.init({
    endpoint: "/api/users/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(loadRoles)
        .then(loadUser)
        .catch((error) => {
            showToast(error.message, "error");
        });
