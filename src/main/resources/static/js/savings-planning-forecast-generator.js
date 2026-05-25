const form = document.querySelector("#savings-planning-generator-form");
const startDateInput = document.querySelector("#savings-planning-generator-start-date");
const durationSlider = document.querySelector("#savings-planning-generator-duration");
const durationValueElement = document.querySelector("#savings-planning-generator-duration-value");
const messageElement = document.querySelector("#savings-planning-generator-message");
const warningElement = document.querySelector("#savings-planning-generator-warning");
const warningTextElement = document.querySelector("#savings-planning-generator-warning-text");

let messages = {};
let currentActiveForecast = null;
const durations = [6, 12, 24, 60, 120];

function setMessage(text, type = "") {
    messageElement.textContent = text;
    messageElement.dataset.type = type;
}

function todayIsoDate() {
    return MoneySnapshotUi.localIsoDate();
}

function durationLabel(durationMonths) {
    return messages[`savingsPlanningGenerator.form.duration.${{
        6: "6m",
        12: "1y",
        24: "2y",
        60: "5y",
        120: "10y"
    }[durationMonths]}`] ?? String(durationMonths);
}

function selectedDurationMonths() {
    return durations[Number(durationSlider.value)] ?? 12;
}

function syncDurationLabel() {
    durationValueElement.textContent = durationLabel(selectedDurationMonths());
}

function formatDate(value) {
    return MoneySnapshotUi.formatDateValue(value);
}

function syncWarningText() {
    if (!currentActiveForecast) {
        warningElement.hidden = true;
        return;
    }

    warningElement.hidden = false;
    warningTextElement.textContent = (messages["savingsPlanningGenerator.warning.description"] ?? "")
            .replace("{fromDate}", formatDate(currentActiveForecast.forecastStartDate))
            .replace("{toDate}", formatDate(currentActiveForecast.forecastEndDate));
}

async function loadLatestForecast() {
    const response = await fetch("/api/savings-planning/forecasts/latest");
    if (response.status === 204) {
        currentActiveForecast = null;
        warningElement.hidden = true;
        return;
    }

    if (!response.ok) {
        throw new Error(messages["savingsPlanningGenerator.error.loadPlan"]);
    }

    const forecast = await response.json();
    if (forecast.forecastEndDate >= todayIsoDate()) {
        currentActiveForecast = forecast;
        syncWarningText();
        return;
    }

    currentActiveForecast = null;
    warningElement.hidden = true;
}

async function generateForecast() {
    const response = await fetch("/api/savings-planning/forecasts", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            forecastStartDate: startDateInput.value,
            durationMonths: selectedDurationMonths()
        })
    });

    if (!response.ok) {
        throw new Error(messages["savingsPlanningGenerator.error.generate"]);
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!startDateInput.value) {
        setMessage(messages["savingsPlanningGenerator.form.required"], "error");
        return;
    }

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setMessage("");

    try {
        await generateForecast();
        setMessage(messages["savingsPlanningGenerator.form.success"], "success");
        window.location.href = "/savings-planning.html";
    } catch (error) {
        setMessage(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

durationSlider.addEventListener("input", syncDurationLabel);

MoneySnapshotI18n.init({
    endpoint: "/api/savings-planning-generator/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        messages = nextMessages;
        document.title = `${messages["savingsPlanningGenerator.heading.title"]} | ${messages["app.name"]}`;
        syncDurationLabel();
        syncWarningText();
    }
})
        .then(() => {
            if (!startDateInput.value) {
                startDateInput.value = todayIsoDate();
            }
            syncDurationLabel();
        })
        .then(loadLatestForecast)
        .catch((error) => {
            setMessage(error.message, "error");
        });
