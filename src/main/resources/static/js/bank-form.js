const bankForm = document.querySelector("#bank-form");
const bankNameInput = document.querySelector("#bank-name");
const formMessage = document.querySelector("#bank-form-message");
const cancelLink = document.querySelector(".split-actions a.button.secondary");
const formMode = bankForm.dataset.mode;
const bankId = bankForm.dataset.bankId;
const returnTo = new URLSearchParams(window.location.search).get("returnTo") ?? "";
const BANKS_ACCOUNTS_NOTIFICATION_KEY = "money-snapshot-banks-accounts-notification";

let messages = {};

function resolveRedirectUrl() {
    const safePath = MoneySnapshotUi.safeReturnToPath(returnTo);
    if (safePath) {
        return safePath;
    }

    return "/banks.html";
}

function syncCancelLink() {
    if (!cancelLink) {
        return;
    }

    cancelLink.href = resolveRedirectUrl();
}

function persistBanksAccountsNotification(messageKey, type = "success") {
    const redirectUrl = resolveRedirectUrl();
    if (!redirectUrl.startsWith("/banks-accounts.html")) {
        return;
    }

    try {
        window.sessionStorage.setItem(BANKS_ACCOUNTS_NOTIFICATION_KEY, JSON.stringify({
            messageKey,
            type
        }));
    } catch (error) {
        console.warn("Cannot save banks-accounts notification state", error);
    }
}

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    const titleKey = formMode === "edit" ? "banks.form.edit.title" : "banks.form.title";
    document.title = `${messages[titleKey]} | ${messages["app.name"]}`;
}

function setFormMessage(text, type = "") {
    formMessage.textContent = text;
    formMessage.dataset.type = type;
}

async function loadBank() {
    if (formMode !== "edit") {
        return;
    }

    const response = await fetch(`/api/banks/${encodeURIComponent(bankId)}`);
    if (response.status === 404) {
        throw new Error(messages["banks.error.notFound"]);
    }

    if (!response.ok) {
        throw new Error(messages["banks.error.loadBank"]);
    }

    const bank = await response.json();
    bankNameInput.value = bank.name;
}

async function saveBank(name) {
    const isEdit = formMode === "edit";
    const response = await fetch(isEdit ? `/api/banks/${encodeURIComponent(bankId)}` : "/api/banks", {
        method: isEdit ? "PUT" : "POST",
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
        throw new Error(messages[isEdit ? "banks.error.update" : "banks.error.create"]);
    }

    return response.json();
}

bankForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = bankNameInput.value.trim();
    if (!name) {
        setFormMessage(messages["banks.form.requiredName"], "error");
        return;
    }

    bankForm.querySelector("button[type='submit']").disabled = true;
    setFormMessage("");

    try {
        await saveBank(name);
        persistBanksAccountsNotification("banks.form.success", "success");
        window.location.href = resolveRedirectUrl();
    } catch (error) {
        setFormMessage(error.message, "error");
        bankForm.querySelector("button[type='submit']").disabled = false;
        bankNameInput.focus();
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/banks/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(() => {
            syncCancelLink();
        })
        .then(loadBank)
        .catch((error) => {
            setFormMessage(error.message, "error");
        });
