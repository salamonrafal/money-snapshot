const messageElement = document.querySelector("#savings-planning-message");
const refreshButton = document.querySelector("#refresh-savings-planning");
const deleteButton = document.querySelector("#delete-savings-planning-forecasts");
const tableWrap = document.querySelector("#savings-planning-table-wrap");
const stickyHeadWrap = document.querySelector("#savings-planning-sticky-head-wrap");
const tableElement = document.querySelector("#savings-planning-table");
const stickyHeadTable = document.querySelector("#savings-planning-sticky-head-table");
const tableBody = document.querySelector("#savings-planning-table-body");
const tableHeadRow = document.querySelector("#savings-planning-table-head-row");
const stickyHeadRow = document.querySelector("#savings-planning-sticky-head-row");
const tableColgroup = document.querySelector("#savings-planning-table-colgroup");
const stickyColgroup = document.querySelector("#savings-planning-sticky-colgroup");
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
let lastStickyHeadWidth = 0;
const tooltipMeasureElement = document.createElement("span");

tooltipMeasureElement.style.position = "fixed";
tooltipMeasureElement.style.left = "-9999px";
tooltipMeasureElement.style.top = "-9999px";
tooltipMeasureElement.style.visibility = "hidden";
tooltipMeasureElement.style.pointerEvents = "none";
tooltipMeasureElement.style.display = "inline-block";
tooltipMeasureElement.style.whiteSpace = "nowrap";
tooltipMeasureElement.style.padding = "8px 10px";
tooltipMeasureElement.style.fontSize = "0.78rem";
tooltipMeasureElement.style.fontWeight = "800";
document.body.append(tooltipMeasureElement);

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
    const durationKeyByMonths = {
        6: "savingsPlanningGenerator.form.duration.6m",
        12: "savingsPlanningGenerator.form.duration.1y",
        24: "savingsPlanningGenerator.form.duration.2y",
        60: "savingsPlanningGenerator.form.duration.5y",
        120: "savingsPlanningGenerator.form.duration.10y"
    };
    const messageKey = durationKeyByMonths[durationMonths];
    return messageKey ? (messages[messageKey] ?? `${durationMonths}`) : `${durationMonths}`;
}

function setTableColumnMetrics(columnCount) {
    tableElement.style.setProperty("--savings-forecast-column-count", String(Math.max(columnCount, 1)));
    stickyHeadTable.style.setProperty("--savings-forecast-column-count", String(Math.max(columnCount, 1)));
}

function measureTooltipWidth(text, maxWidth) {
    tooltipMeasureElement.textContent = text;
    tooltipMeasureElement.style.maxWidth = `${maxWidth}px`;
    return Math.min(tooltipMeasureElement.getBoundingClientRect().width, maxWidth);
}

function updateStickyTooltipPlacement(target) {
    if (!target || !stickyHeadWrap.contains(target)) {
        return;
    }

    const tooltipText = target.dataset.tooltip;
    if (!tooltipText) {
        return;
    }

    const wrapRect = stickyHeadWrap.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const edgePadding = 8;
    const availableWidth = Math.max(wrapRect.width - (edgePadding * 2), 0);
    const tooltipWidth = measureTooltipWidth(tooltipText, availableWidth);
    const minCenter = wrapRect.left + edgePadding + (tooltipWidth / 2);
    const maxCenter = wrapRect.right - edgePadding - (tooltipWidth / 2);
    const visibleLeft = Math.max(targetRect.left, wrapRect.left + edgePadding);
    const visibleRight = Math.min(targetRect.right, wrapRect.right - edgePadding);
    const fallbackCenter = targetRect.left + (targetRect.width / 2);
    const visibleCenter = visibleLeft < visibleRight
            ? visibleLeft + ((visibleRight - visibleLeft) / 2)
            : fallbackCenter;
    const clampedCenter = Math.min(Math.max(visibleCenter, minCenter), maxCenter);
    const centerOffset = clampedCenter - targetRect.left;

    target.style.setProperty("--sticky-tooltip-center-x", `${centerOffset}px`);
    target.style.setProperty("--sticky-tooltip-max-width", `${availableWidth}px`);
}

function syncStickyHeaderScroll() {
    if (tableWrap.hidden) {
        stickyHeadWrap.hidden = true;
        return;
    }

    stickyHeadWrap.hidden = false;
    stickyHeadTable.style.transform = `translateX(${-tableWrap.scrollLeft}px)`;
}

function syncStickyHeaderLayout() {
    if (tableWrap.hidden) {
        stickyHeadWrap.hidden = true;
        lastStickyHeadWidth = 0;
        return;
    }

    stickyHeadWrap.hidden = false;
    const nextWidth = tableElement.offsetWidth;
    if (nextWidth !== lastStickyHeadWidth) {
        stickyHeadTable.style.width = `${nextWidth}px`;
        lastStickyHeadWidth = nextWidth;
    }
    syncStickyHeaderScroll();
}

function renderEmptyState() {
    currentForecast = null;
    tableWrap.hidden = true;
    stickyHeadWrap.hidden = true;
    summaryElement.hidden = true;
    emptyState.hidden = false;
    deleteButton.disabled = true;
    resetTableHead();
    tableBody.replaceChildren();
}

function resetTableHead() {
    setTableColumnMetrics(1);
    const dateLabel = messages["savingsPlanning.table.date"] ?? "Data";
    const accessibleTh = document.createElement("th");
    accessibleTh.scope = "col";
    const accessibleLabel = document.createElement("span");
    accessibleLabel.className = "savings-forecast-accessible-label";
    accessibleLabel.textContent = dateLabel;
    accessibleTh.append(accessibleLabel);
    const stickyTh = document.createElement("th");
    stickyTh.scope = "col";
    stickyTh.textContent = dateLabel;
    tableHeadRow.replaceChildren(accessibleTh);
    stickyHeadRow.replaceChildren(stickyTh);
    tableColgroup.replaceChildren(Object.assign(document.createElement("col"), {
        className: "savings-forecast-date-col"
    }));
    stickyColgroup.replaceChildren(Object.assign(document.createElement("col"), {
        className: "savings-forecast-date-col"
    }));
}

function createAccountHeadCell(entry, tooltipEnabled) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "savings-forecast-account-head";
    const headContent = document.createElement("div");
    const accountLine = document.createElement("span");
    const bankLine = document.createElement("span");
    const accountLabel = `[${entry.currencyCode}] ${entry.accountName}`;
    const fullLabel = `${accountLabel} · ${entry.bankName}`;

    headContent.className = "savings-forecast-head-content";
    th.setAttribute("aria-label", fullLabel);

    if (tooltipEnabled) {
        accountLine.textContent = accountLabel;
        bankLine.textContent = entry.bankName;
        MoneySnapshotUi.setTooltip(headContent, fullLabel);
    } else {
        headContent.classList.add("savings-forecast-accessible-label");
        headContent.textContent = fullLabel;
    }

    if (tooltipEnabled) {
        headContent.append(accountLine, bankLine);
    }
    th.append(headContent);
    return th;
}

function createSummaryHeadCell(currencyCode, tooltipEnabled) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "savings-forecast-account-head savings-forecast-summary-head";
    const headContent = document.createElement("div");
    const summaryLine = document.createElement("span");
    const summaryLabel = `${messages["savingsPlanning.table.summary"] ?? "Podsumowanie"} [${currencyCode}]`;

    headContent.className = "savings-forecast-head-content";
    th.setAttribute("aria-label", summaryLabel);

    if (tooltipEnabled) {
        summaryLine.textContent = summaryLabel;
        MoneySnapshotUi.setTooltip(headContent, summaryLabel);
    } else {
        headContent.classList.add("savings-forecast-accessible-label");
        headContent.textContent = summaryLabel;
    }

    if (tooltipEnabled) {
        headContent.append(summaryLine);
    }
    th.append(headContent);
    return th;
}

function renderForecastTableEmptyRun(forecast) {
    currentForecast = forecast;
    emptyState.hidden = true;
    tableWrap.hidden = false;
    summaryElement.hidden = false;
    deleteButton.disabled = false;
    generatedAtElement.textContent = formatDateTime(forecast.generatedAt);
    periodElement.textContent = `${formatDate(forecast.forecastStartDate)} - ${formatDate(forecast.forecastEndDate)}`;
    durationElement.textContent = durationLabel(forecast.durationMonths);
    accountCountElement.textContent = "0";
    resetTableHead();

    const row = document.createElement("tr");
    row.className = "savings-forecast-empty-row";
    const cell = document.createElement("td");
    cell.className = "savings-forecast-empty-cell";
    cell.colSpan = 1;
    cell.textContent = messages["savingsPlanning.empty.description"] ?? "";
    row.append(cell);
    tableBody.replaceChildren(row);
    requestAnimationFrame(syncStickyHeaderLayout);
}

function renderForecastTable(forecast) {
    if (!forecast.entries || forecast.entries.length === 0) {
        renderForecastTableEmptyRun(forecast);
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
        tableColgroup.append(Object.assign(document.createElement("col"), {
            className: "savings-forecast-account-col"
        }));
        stickyColgroup.append(Object.assign(document.createElement("col"), {
            className: "savings-forecast-account-col"
        }));
        tableHeadRow.append(createAccountHeadCell(entry, false));
        stickyHeadRow.append(createAccountHeadCell(entry, true));
    });

    const summaryByMonthAndCurrency = new Map(
        (forecast.summaries ?? []).map((summary) => [
            `${summary.forecastMonth}|${summary.currencyCode}`,
            summary
        ])
    );

    const summaryCurrencies = [...new Set((forecast.summaries ?? []).map((summary) => summary.currencyCode))];
    setTableColumnMetrics(1 + forecast.entries.length + summaryCurrencies.length);

    summaryCurrencies.forEach((currencyCode) => {
        tableColgroup.append(Object.assign(document.createElement("col"), {
            className: "savings-forecast-summary-col"
        }));
        stickyColgroup.append(Object.assign(document.createElement("col"), {
            className: "savings-forecast-summary-col"
        }));
        tableHeadRow.append(createSummaryHeadCell(currencyCode, false));
        stickyHeadRow.append(createSummaryHeadCell(currencyCode, true));
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
            const summary = summaryByMonthAndCurrency.get(`${month}|${currencyCode}`);

            const cell = document.createElement("td");
            cell.textContent = summary ? formatAmount(summary.totalBalance) : "-";
            cell.dataset.label = `${messages["savingsPlanning.table.summary"] ?? "Podsumowanie"} [${currencyCode}]`;
            cell.className = "numeric-cell savings-forecast-summary-cell";
            row.append(cell);
        });
        return row;
    }));
    requestAnimationFrame(syncStickyHeaderLayout);
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

tableWrap.addEventListener("scroll", syncStickyHeaderScroll, {passive: true});
window.addEventListener("resize", () => {
    syncStickyHeaderLayout();
});
stickyHeadWrap.addEventListener("pointerover", (event) => {
    const tooltipTarget = event.target.closest(".has-app-tooltip");
    if (tooltipTarget) {
        updateStickyTooltipPlacement(tooltipTarget);
    }
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
