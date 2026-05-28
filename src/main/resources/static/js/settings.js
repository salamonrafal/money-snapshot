const settingsForm = document.querySelector("#settings-form");
const defaultCurrencySelect = document.querySelector("#settings-default-currency");
const themeSelect = document.querySelector("#settings-theme");
const dateTimeFormatInput = document.querySelector("#settings-date-time-format");
const moneyFormatInput = document.querySelector("#settings-money-format");
const billingMonthStartDayInput = document.querySelector("#settings-billing-month-start-day");
const formMessage = document.querySelector("#settings-form-message");

let messages = {};

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    document.title = `${messages["settings.heading.title"]} | ${messages["app.name"]}`;
}

function setMessage(text, type = "") {
    formMessage.textContent = text;
    formMessage.dataset.type = type;
}

function normalizedBillingMonthStartDayValue() {
    const rawValue = billingMonthStartDayInput.value.trim();
    if (!/^\d+$/.test(rawValue)) {
        return null;
    }

    const numericValue = Number(rawValue);
    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 31) {
        return null;
    }

    return String(numericValue);
}

function fillSettings(settings) {
    defaultCurrencySelect.value = settings.defaultCurrency ?? "PLN";
    themeSelect.value = settings.theme ?? "light";
    dateTimeFormatInput.value = settings.dateTimeFormat ?? "Y-m-d H:m";
    moneyFormatInput.value = settings.moneyFormat ?? "### ###,00 zł";
    billingMonthStartDayInput.value = settings.billingMonthStartDay ?? 1;
    MoneySnapshotUi.applyTheme(themeSelect.value);
}

async function loadSettings() {
    const response = await fetch("/api/users/me/settings");
    if (!response.ok) {
        throw new Error(messages["settings.error.load"]);
    }

    fillSettings(await response.json());
}

async function saveSettings() {
    const billingMonthStartDay = normalizedBillingMonthStartDayValue();
    const response = await fetch("/api/users/me/settings", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            values: {
                defaultCurrency: defaultCurrencySelect.value,
                theme: themeSelect.value,
                dateTimeFormat: dateTimeFormatInput.value.trim(),
                moneyFormat: moneyFormatInput.value.trim(),
                billingMonthStartDay
            }
        })
    });

    if (!response.ok) {
        throw new Error(messages["settings.error.update"]);
    }

    fillSettings(await response.json());
    MoneySnapshotUi.clearUserSettingsCache();
}

settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const billingMonthStartDay = normalizedBillingMonthStartDayValue();
    if (!dateTimeFormatInput.value.trim()
            || !moneyFormatInput.value.trim()
            || billingMonthStartDay === null) {
        setMessage(messages["settings.form.required"], "error");
        return;
    }

    const submitButton = settingsForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setMessage("");
    try {
        await saveSettings();
        setMessage(messages["settings.form.success"], "success");
    } catch (error) {
        setMessage(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/settings/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(loadSettings)
        .catch((error) => {
            setMessage(error.message, "error");
        });
