const profileForm = document.querySelector("#profile-form");
const emailInput = document.querySelector("#profile-email");
const firstNameInput = document.querySelector("#profile-first-name");
const lastNameInput = document.querySelector("#profile-last-name");
const descriptionInput = document.querySelector("#profile-description");
const passwordInput = document.querySelector("#profile-password");
const formMessage = document.querySelector("#profile-form-message");
const toastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});

let messages = {};

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    document.title = `${messages["profile.heading.title"]} | ${messages["app.name"]}`;
}

function setMessage(text, type = "") {
    formMessage.textContent = text;
    formMessage.dataset.type = type;
}

function showToast(text, type = "") {
    if (!text) {
        return;
    }

    toastManager.clear();
    toastManager.show(text, {type});
}

function fillForm(user) {
    emailInput.value = user.email;
    firstNameInput.value = user.firstName;
    lastNameInput.value = user.lastName;
    descriptionInput.value = user.description ?? "";
    passwordInput.value = "";
}

async function loadProfile() {
    const profileResponse = await fetch("/api/users/me");
    if (!profileResponse.ok) {
        throw new Error(messages["profile.error.load"]);
    }

    fillForm(await profileResponse.json());
}

async function updateProfile() {
    const profileResponse = await fetch("/api/users/me", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            firstName: firstNameInput.value.trim(),
            lastName: lastNameInput.value.trim(),
            description: descriptionInput.value.trim() || null,
            password: passwordInput.value || null
        })
    });

    if (!profileResponse.ok) {
        throw new Error(messages["profile.error.update"]);
    }

    fillForm(await profileResponse.json());
}

profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
        setMessage(messages["profile.form.required"], "error");
        return;
    }

    const submitButton = profileForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setMessage("");
    try {
        await updateProfile();
        showToast(messages["profile.form.success"], "success");
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/profile/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(loadProfile)
        .catch((error) => {
            setMessage(error.message, "error");
            showToast(error.message, "error");
        });
