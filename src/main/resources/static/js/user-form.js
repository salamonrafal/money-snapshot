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
const saveButton = document.querySelector("#save-user");
const formMessage = document.querySelector("#user-form-message");

let messages = {};
let roles = [];

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    const title = userId ? messages["users.form.editTitle"] : messages["users.form.title"];
    document.title = `${title} | ${messages["app.name"]}`;
    pageTitle.textContent = title;
    saveButton.textContent = userId ? messages["users.form.update"] : messages["users.form.submit"];
    renderRoles();
}

function setMessage(text, type = "") {
    formMessage.textContent = text;
    formMessage.dataset.type = type;
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

async function saveUser(payload) {
    const response = await fetch(userId ? `/api/users/${encodeURIComponent(userId)}` : "/api/users", {
        method: userId ? "PUT" : "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    if (response.status === 409) {
        throw new Error(messages["users.error.duplicate"]);
    }
    if (response.status === 400) {
        throw new Error(messages["users.error.invalid"]);
    }
    if (!response.ok) {
        throw new Error(userId ? messages["users.error.update"] : messages["users.error.create"]);
    }
}

userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!emailInput.value.trim() || !firstNameInput.value.trim() || !lastNameInput.value.trim() || !roleSelect.value) {
        setMessage(messages["users.form.required"], "error");
        return;
    }
    if (!userId && !passwordInput.value) {
        setMessage(messages["users.form.requiredPassword"], "error");
        return;
    }

    saveButton.disabled = true;
    setMessage("");
    try {
        await saveUser(buildPayload());
        window.location.href = "/users.html";
    } catch (error) {
        setMessage(error.message, "error");
        saveButton.disabled = false;
    }
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
            setMessage(error.message, "error");
        });
