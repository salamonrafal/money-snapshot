const messageElement = document.querySelector("#savings-planning-message");
const refreshButton = document.querySelector("#refresh-savings-planning");
const deleteButton = document.querySelector("#delete-savings-planning-forecasts");
const tableWrap = document.querySelector("#savings-planning-table-wrap");
const tableBody = document.querySelector("#savings-planning-table-body");
const tableHeadRow = document.querySelector("#savings-planning-table-head-row");
const tableColgroup = document.querySelector("#savings-planning-table-colgroup");
const emptyState = document.querySelector("#savings-planning-empty-state");
const summaryElement = document.querySelector("#savings-planning-summary");
const generatedAtElement = document.querySelector("#savings-planning-generated-at");
const periodElement = document.querySelector("#savings-planning-period");
const durationElement = document.querySelector("#savings-planning-duration");
const accountCountElement = document.querySelector("#savings-planning-account-count");
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-savings-forecasts-modal",
    subjectSelector: "#delete-savings-forecasts-subject",
    confirmSelector: "#confirm-delete-savings-forecasts",
    cancelSelector: "#cancel-delete-savings-forecasts"
});

let currentLanguage = "pl";
let messages = {};
let currentForecast = null;
let userSettings = null;

function setMessage(text, type = "") {
    messageElement.textContent = text;
    messageElement.dataset.type = type;
}

function formatDate(value) {
    return value ? MoneySnapshotUi.formatDateValue(value, userSettings) : "-";
}

function formatDateTime(value) {
    return value ? MoneySnapshotUi.formatDateTimeValue(value, userSettings) : "-";
}

function formatAmount(value) {
    return MoneySnapshotUi.formatMoneyValue(value, userSettings);
}

function formatMonthLabel(value) {
    const date = new Date(`${value}T00:00:00Z`);
    return new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "pl-PL", {
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    }).format(date);
}

function durationLabel(durationMonths) {
    const mapping = {
        6: "6 miesięcy",
        12: "1 rok",
        24: "2 lata",
        60: "5 lat",
        120: "10 lat"
    };
    if (currentLanguage === "en") {
        return {
            6: "6 months",
            12: "1 year",
            24: "2 years",
            60: "5 years",
            120: "10 years"
        }[durationMonths] ?? `${durationMonths}`;
    }
    return mapping[durationMonths] ?? `${durationMonths}`;
}

function renderEmptyState() {
    currentForecast = null;
    tableWrap.hidden = true;
    summaryElement.hidden = true;
    emptyState.hidden = false;
    deleteButton.disabled = true;
    resetTableHead();
    tableBody.replaceChildren();
}

function resetTableHead() {
    const th = document.createElement("th");
    th.textContent = messages["savingsPlanning.table.date"] ?? "Data";
    tableHeadRow.replaceChildren(th);
    tableColgroup.replaceChildren(Object.assign(document.createElement("col"), {
        className: "savings-forecast-date-col"
    }));
}

function renderForecastTable(forecast) {
    if (!forecast.entries || forecast.entries.length === 0) {
        renderEmptyState();
        return;
    }

    currentForecast = forecast;
    emptyState.hidden = true;
    tableWrap.hidden = false;
    summaryElement.hidden = false;
    deleteButton.disabled = false;
    generatedAtElement.textContent = formatDateTime(forecast.generatedAt);
    periodElement.textContent = `${formatDate(forecast.forecastStartDate)} - ${formatDate(forecast.forecastEndDate)}`;
    durationElement.textContent = durationLabel(forecast.durationMonths);
    accountCountElement.textContent = String(forecast.entries.length);

    resetTableHead();
    forecast.entries.forEach((entry) => {
        const col = document.createElement("col");
        col.className = "savings-forecast-account-col";
        tableColgroup.append(col);

        const th = document.createElement("th");
        th.innerHTML = [
            `<span>[${entry.currencyCode}] ${entry.accountName}</span>`,
            `<span>${entry.bankName}</span>`
        ].join("");
        th.className = "savings-forecast-account-head";
        tableHeadRow.append(th);
    });

    const summaryCurrencies = [...new Set((forecast.summaries ?? []).map((summary) => summary.currencyCode))];
    summaryCurrencies.forEach((currencyCode) => {
        const col = document.createElement("col");
        col.className = "savings-forecast-summary-col";
        tableColgroup.append(col);

        const th = document.createElement("th");
        th.innerHTML = [
            `<span>${messages["savingsPlanning.table.summary"] ?? "Podsumowanie"} [${currencyCode}]</span>`
        ].join("");
        th.className = "savings-forecast-account-head savings-forecast-summary-head";
        tableHeadRow.append(th);
    });

    const monthLabels = forecast.forecastMonths ?? [];
    tableBody.replaceChildren(...monthLabels.map((month, monthIndex) => {
        const row = document.createElement("tr");
        const dateCell = document.createElement("td");
        dateCell.textContent = formatMonthLabel(month);
        dateCell.dataset.label = messages["savingsPlanning.table.date"] ?? "Data";
        dateCell.className = "savings-forecast-date-cell";
        row.append(dateCell);

        forecast.entries.forEach((entry) => {
            const monthValue = (entry.monthlyBalances ?? [])[monthIndex];
            const cell = document.createElement("td");
            cell.textContent = monthValue ? formatAmount(monthValue.balance) : "-";
            cell.dataset.label = `[${entry.currencyCode}] ${entry.accountName} · ${entry.bankName}`;
            cell.className = "numeric-cell";
            row.append(cell);
        });

        summaryCurrencies.forEach((currencyCode) => {
            const summary = (forecast.summaries ?? []).find((item) =>
                item.currencyCode === currencyCode && item.forecastMonth === month
            );

            const cell = document.createElement("td");
            cell.textContent = summary ? formatAmount(summary.totalBalance) : "-";
            cell.dataset.label = `${messages["savingsPlanning.table.summary"] ?? "Podsumowanie"} [${currencyCode}]`;
            cell.className = "numeric-cell savings-forecast-summary-cell";
            row.append(cell);
        });
        return row;
    }));
}

async function loadLatestForecast() {
    const response = await fetch("/api/savings-planning/forecasts/latest");
    if (response.status === 204) {
        renderEmptyState();
        return;
    }

    if (!response.ok) {
        throw new Error(messages["savingsPlanning.error.load"]);
    }

    renderForecastTable(await response.json());
}

async function deleteAllForecasts() {
    const response = await fetch("/api/savings-planning/forecasts", {
        method: "DELETE"
    });

    if (!response.ok) {
        throw new Error(messages["savingsPlanning.error.delete"]);
    }
}

function rerender() {
    if (currentForecast) {
        renderForecastTable(currentForecast);
        return;
    }
    renderEmptyState();
}

refreshButton.addEventListener("click", () => {
    setMessage("");
    loadLatestForecast().catch((error) => {
        setMessage(error.message, "error");
    });
});

deleteButton.addEventListener("click", () => {
    deleteModal.open({id: "all-forecasts"}, messages["savingsPlanning.delete.subject"] ?? "");
});

deleteModal.confirmButton.addEventListener("click", async () => {
    deleteModal.confirmButton.disabled = true;
    deleteButton.disabled = true;
    setMessage("");

    try {
        await deleteAllForecasts();
        deleteModal.close();
        renderEmptyState();
        setMessage(messages["savingsPlanning.delete.success"], "success");
    } catch (error) {
        deleteModal.close();
        deleteButton.disabled = currentForecast === null;
        setMessage(error.message, "error");
    } finally {
        deleteModal.confirmButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/savings-planning/messages",
    onLanguageChange: ({language, messages: nextMessages}) => {
        currentLanguage = language;
        messages = nextMessages;
        document.title = `${messages["savingsPlanning.heading.title"]} | ${messages["app.name"]}`;
        rerender();
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadLatestForecast)
        .catch((error) => {
            setMessage(error.message, "error");
            renderEmptyState();
        });
