const form = document.querySelector("#savings-planning-generator-form");
const startDateInput = document.querySelector("#savings-planning-generator-start-date");
const durationSlider = document.querySelector("#savings-planning-generator-duration");
const rangeControlElement = document.querySelector(".range-control");
const rangeTicksElement = document.querySelector(".range-ticks");
const messageElement = document.querySelector("#savings-planning-generator-message");
const warningElement = document.querySelector("#savings-planning-generator-warning");
const warningTextElement = document.querySelector("#savings-planning-generator-warning-text");
const SAVINGS_PLANNING_NOTIFICATION_KEY = "money-snapshot-savings-planning-notification";
const toastManager = MoneySnapshotUi.createToastManager({
    durationMs: 5000
});

let messages = {};
let currentActiveForecast = null;
let userSettings = null;
const durations = [6, 12, 24, 60, 120];

function setMessage(text, type = "") {
    messageElement.textContent = text;
    messageElement.dataset.type = type;

    if (!text) {
        toastManager.clear();
        return;
    }

    toastManager.show(text, {type});
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

function syncDurationAriaValueText() {
    if (!durationSlider) {
        return;
    }

    durationSlider.setAttribute("aria-valuetext", durationLabel(selectedDurationMonths()));
}

function syncActiveRangeTick() {
    if (!rangeTicksElement || !durationSlider) {
        return;
    }

    const selectedIndex = Number(durationSlider.value);
    rangeTicksElement.querySelectorAll("[data-range-index]").forEach((label) => {
        label.classList.toggle("is-active", Number(label.dataset.rangeIndex ?? "-1") === selectedIndex);
    });
}

function layoutRangeTicks() {
    if (!rangeControlElement || !rangeTicksElement || !durationSlider) {
        return;
    }

    const tickLabels = [...rangeTicksElement.querySelectorAll("[data-range-index]")];
    if (tickLabels.length === 0) {
        return;
    }

    const sliderStyles = window.getComputedStyle(durationSlider);
    const paddingLeft = Number.parseFloat(sliderStyles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(sliderStyles.paddingRight) || 0;
    const thumbOffset = Number.parseFloat(sliderStyles.getPropertyValue("--range-thumb-offset")) || 10;
    const trackWidth = Math.max(durationSlider.clientWidth - paddingLeft - paddingRight - (thumbOffset * 2), 0);
    const maxIndex = Math.max(tickLabels.length - 1, 1);
    const containerWidth = rangeTicksElement.clientWidth;

    tickLabels.forEach((label) => {
        const index = Number(label.dataset.rangeIndex ?? "0");
        const pointX = paddingLeft + thumbOffset + (trackWidth * (index / maxIndex));
        const labelWidth = label.offsetWidth;
        const desiredLeft = pointX - (labelWidth / 2);
        const clampedLeft = Math.min(Math.max(desiredLeft, 0), Math.max(containerWidth - labelWidth, 0));
        label.style.left = `${clampedLeft}px`;
    });
}

function formatDate(value) {
    return MoneySnapshotUi.formatDateValue(value, userSettings);
}

function clearActiveForecastWarning() {
    currentActiveForecast = null;
    warningElement.hidden = true;
}

function persistSavingsPlanningNotification(messageKey, type = "success") {
    try {
        window.sessionStorage.setItem(SAVINGS_PLANNING_NOTIFICATION_KEY, JSON.stringify({
            messageKey,
            type
        }));
    } catch (error) {
        console.warn("Cannot save savings planning notification state", error);
    }
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
    clearActiveForecastWarning();

    const response = await fetch("/api/savings-planning/forecasts/latest", {
        cache: "no-store"
    });
    if (response.status === 204) {
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

    clearActiveForecastWarning();
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
        persistSavingsPlanningNotification("savingsPlanningGenerator.form.success", "success");
        window.location.href = "/savings-planning.html";
    } catch (error) {
        setMessage(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

durationSlider.addEventListener("input", () => {
    syncDurationAriaValueText();
    syncActiveRangeTick();
});
window.addEventListener("resize", layoutRangeTicks);

window.addEventListener("pageshow", (event) => {
    if (!event.persisted) {
        return;
    }

    clearActiveForecastWarning();
    loadLatestForecast().catch((error) => {
        setMessage(error.message, "error");
    });
});

MoneySnapshotI18n.init({
    endpoint: "/api/savings-planning-generator/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        messages = nextMessages;
        document.title = `${messages["savingsPlanningGenerator.heading.title"]} | ${messages["app.name"]}`;
        syncDurationAriaValueText();
        syncActiveRangeTick();
        syncWarningText();
        requestAnimationFrame(layoutRangeTicks);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(() => {
            if (!startDateInput.value) {
                startDateInput.value = todayIsoDate();
            }
            syncDurationAriaValueText();
            syncActiveRangeTick();
            requestAnimationFrame(layoutRangeTicks);
        })
        .then(loadLatestForecast)
        .catch((error) => {
            setMessage(error.message, "error");
        });
