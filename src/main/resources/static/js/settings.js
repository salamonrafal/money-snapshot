const settingsForm = document.querySelector("#settings-form");
const defaultCurrencySelect = document.querySelector("#settings-default-currency");
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

function fillSettings(settings) {
    defaultCurrencySelect.value = settings.defaultCurrency ?? "PLN";
    dateTimeFormatInput.value = settings.dateTimeFormat ?? "Y-m-d H:m";
    moneyFormatInput.value = settings.moneyFormat ?? "### ###,00 zł";
    billingMonthStartDayInput.value = settings.billingMonthStartDay ?? 1;
}

async function loadSettings() {
    const response = await fetch("/api/users/me/settings");
    if (!response.ok) {
        throw new Error(messages["settings.error.load"]);
    }

    fillSettings(await response.json());
}

async function saveSettings() {
    const response = await fetch("/api/users/me/settings", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            values: {
                defaultCurrency: defaultCurrencySelect.value,
                dateTimeFormat: dateTimeFormatInput.value.trim(),
                moneyFormat: moneyFormatInput.value.trim(),
                billingMonthStartDay: billingMonthStartDayInput.value.trim()
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
    const billingMonthStartDay = Number.parseInt(billingMonthStartDayInput.value, 10);
    if (!dateTimeFormatInput.value.trim()
            || !moneyFormatInput.value.trim()
            || !Number.isInteger(billingMonthStartDay)
            || billingMonthStartDay < 1
            || billingMonthStartDay > 31) {
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
