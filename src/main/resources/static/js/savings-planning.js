const messageElement = document.querySelector("#savings-planning-message");
const refreshButton = document.querySelector("#refresh-savings-planning");
const deleteButton = document.querySelector("#delete-savings-planning-forecasts");
const generateButtons = document.querySelectorAll(".savings-planning-generate-button");
const settingsButtons = document.querySelectorAll(".savings-planning-settings-button");
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
const settingsModalForm = document.querySelector("#savings-planning-settings-modal-form");
const settingsModalTableBody = document.querySelector("#savings-planning-settings-modal-table-body");
const settingsModalSubmitButton = document.querySelector("#savings-planning-settings-modal-submit");
const generatorModalForm = document.querySelector("#savings-planning-generator-modal-form");
const generatorModalStartDateInput = document.querySelector("#savings-planning-generator-modal-start-date");
const generatorModalDurationSlider = document.querySelector("#savings-planning-generator-modal-duration");
const generatorModalRangeControlElement = generatorModalForm?.querySelector(".range-control") ?? null;
const generatorModalRangeTicksElement = document.querySelector("#savings-planning-generator-modal-range-ticks");
const generatorModalWarningElement = document.querySelector("#savings-planning-generator-modal-warning");
const generatorModalWarningTextElement = document.querySelector("#savings-planning-generator-modal-warning-text");
const generatorModalSubmitButton = document.querySelector("#savings-planning-generator-modal-submit");
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-savings-forecasts-modal",
    subjectSelector: "#delete-savings-forecasts-subject",
    confirmSelector: "#confirm-delete-savings-forecasts",
    cancelSelector: "#cancel-delete-savings-forecasts"
});
const settingsModal = settingsModalForm
    ? MoneySnapshotUi.createModal({
        modalSelector: "#savings-planning-settings-modal",
        closeSelectors: ["#savings-planning-settings-modal [data-savings-planning-settings-modal-close]"]
    })
    : null;
const generatorModal = generatorModalForm
    ? MoneySnapshotUi.createModal({
        modalSelector: "#savings-planning-generator-modal",
        closeSelectors: ["#savings-planning-generator-modal [data-savings-planning-generator-modal-close]"]
    })
    : null;
const toastManager = MoneySnapshotUi.createToastManager({
    durationMs: 5000
});
const SAVINGS_PLANNING_NOTIFICATION_KEY = "money-snapshot-savings-planning-notification";

let currentLanguage = "pl";
let messages = {};
let currentForecast = null;
let currentActiveForecast = null;
let userSettings = null;
let settingsAccounts = [];
let settingsAccountsLoaded = false;
let lastStickyHeadWidth = 0;
const tooltipMeasureElement = document.createElement("span");
let tooltipMeasureElementReady = false;
const generatorDurations = [6, 12, 24, 60, 120];

tooltipMeasureElement.setAttribute("aria-hidden", "true");
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

function ensureTooltipMeasureElement() {
    if (tooltipMeasureElementReady || !document.body) {
        return;
    }

    document.body.append(tooltipMeasureElement);
    tooltipMeasureElementReady = true;
}

function setMessage(text, type = "") {
    messageElement.textContent = text;
    messageElement.dataset.type = type;

    if (!text) {
        toastManager.clear();
        return;
    }

    toastManager.show(text, {type});
}

function showToastOnly(text, type = "") {
    messageElement.textContent = "";
    messageElement.dataset.type = "";

    if (!text) {
        toastManager.clear();
        return;
    }

    toastManager.show(text, {type});
}

function contributionPlaceholder() {
    return currentLanguage === "en" ? "0.00" : "0,00";
}

function normalizeContributionValue(rawValue) {
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
        return null;
    }

    const normalizedValue = trimmedValue.replace(/\s+/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
        return null;
    }

    return normalizedValue;
}

function createContributionInput(account) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "forecast-input";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.placeholder = contributionPlaceholder();
    input.value = account.forecastedMonthlyContribution ?? "";
    input.dataset.accountId = account.accountId;
    return input;
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

function todayIsoDate() {
    return MoneySnapshotUi.localIsoDate();
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

function selectedGeneratorDurationMonths() {
    return generatorDurations[Number(generatorModalDurationSlider?.value)] ?? 12;
}

function syncGeneratorDurationAriaValueText() {
    if (!generatorModalDurationSlider) {
        return;
    }

    generatorModalDurationSlider.setAttribute("aria-valuetext", durationLabel(selectedGeneratorDurationMonths()));
}

function syncGeneratorActiveRangeTick() {
    if (!generatorModalRangeTicksElement || !generatorModalDurationSlider) {
        return;
    }

    const selectedIndex = Number(generatorModalDurationSlider.value);
    generatorModalRangeTicksElement.querySelectorAll("[data-range-index]").forEach((label) => {
        label.classList.toggle("is-active", Number(label.dataset.rangeIndex ?? "-1") === selectedIndex);
    });
}

function layoutGeneratorRangeTicks() {
    if (!generatorModalRangeControlElement || !generatorModalRangeTicksElement || !generatorModalDurationSlider) {
        return;
    }

    const tickLabels = [...generatorModalRangeTicksElement.querySelectorAll("[data-range-index]")];
    if (tickLabels.length === 0) {
        return;
    }

    const sliderStyles = window.getComputedStyle(generatorModalDurationSlider);
    const paddingLeft = Number.parseFloat(sliderStyles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(sliderStyles.paddingRight) || 0;
    const thumbOffset = Number.parseFloat(sliderStyles.getPropertyValue("--range-thumb-offset")) || 10;
    const trackWidth = Math.max(generatorModalDurationSlider.clientWidth - paddingLeft - paddingRight - (thumbOffset * 2), 0);
    const maxIndex = Math.max(tickLabels.length - 1, 1);
    const containerWidth = generatorModalRangeTicksElement.clientWidth;

    tickLabels.forEach((label) => {
        const index = Number(label.dataset.rangeIndex ?? "0");
        const pointX = paddingLeft + thumbOffset + (trackWidth * (index / maxIndex));
        const labelWidth = label.offsetWidth;
        const desiredLeft = pointX - (labelWidth / 2);
        const clampedLeft = Math.min(Math.max(desiredLeft, 0), Math.max(containerWidth - labelWidth, 0));
        label.style.left = `${clampedLeft}px`;
    });
}

function clearActiveForecastWarning() {
    currentActiveForecast = null;
    if (generatorModalWarningElement) {
        generatorModalWarningElement.hidden = true;
    }
}

function syncGeneratorWarningText() {
    if (!generatorModalWarningElement || !generatorModalWarningTextElement) {
        return;
    }

    if (!currentActiveForecast) {
        generatorModalWarningElement.hidden = true;
        return;
    }

    generatorModalWarningElement.hidden = false;
    generatorModalWarningTextElement.textContent = (messages["savingsPlanningGenerator.warning.description"] ?? "")
        .replace("{fromDate}", formatDate(currentActiveForecast.forecastStartDate))
        .replace("{toDate}", formatDate(currentActiveForecast.forecastEndDate));
}

function showPendingNotification() {
    let rawValue = "";
    try {
        rawValue = window.sessionStorage.getItem(SAVINGS_PLANNING_NOTIFICATION_KEY) ?? "";
    } catch (error) {
        console.warn("Cannot access savings planning notification state", error);
        return;
    }

    if (!rawValue) {
        return;
    }

    try {
        window.sessionStorage.removeItem(SAVINGS_PLANNING_NOTIFICATION_KEY);
    } catch (error) {
        console.warn("Cannot clear savings planning notification state", error);
    }

    try {
        const notification = JSON.parse(rawValue);
        const text = messages[notification?.messageKey] ?? "";
        if (text) {
            if ([
                "savingsPlanningGenerator.form.success",
                "savingsPlanningSettings.form.success"
            ].includes(notification?.messageKey)) {
                showToastOnly(text, notification?.type ?? "");
            } else {
                setMessage(text, notification?.type ?? "");
            }
        }
    } catch (error) {
        console.warn("Cannot parse savings planning notification state", error);
    }
}

function renderSettingsEmpty(message) {
    if (!settingsModalTableBody) {
        return;
    }

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = message;
    row.append(cell);
    settingsModalTableBody.replaceChildren(row);
}

function renderSettingsAccounts(accounts) {
    if (!settingsModalTableBody) {
        return;
    }

    settingsAccounts = accounts;
    settingsAccountsLoaded = true;

    if (accounts.length === 0) {
        renderSettingsEmpty(messages["savingsPlanningSettings.empty"] ?? "");
        return;
    }

    settingsModalTableBody.replaceChildren(...accounts.map((account) => {
        const row = document.createElement("tr");
        const accountCell = document.createElement("td");
        const bankCell = document.createElement("td");
        const currencyCell = document.createElement("td");
        const contributionCell = document.createElement("td");

        accountCell.textContent = account.accountName;
        bankCell.textContent = account.bankName;
        currencyCell.textContent = account.currencyCode;
        contributionCell.append(createContributionInput(account));
        row.append(accountCell, bankCell, currencyCell, contributionCell);
        return row;
    }));
}

async function loadSettingsAccounts() {
    const response = await fetch("/api/accounts/savings-planning");
    if (!response.ok) {
        throw new Error(messages["savingsPlanningSettings.error.load"]);
    }

    renderSettingsAccounts(await response.json());
}

function collectSettingsPayload() {
    if (!settingsModalTableBody) {
        return {accounts: []};
    }

    const inputs = settingsModalTableBody.querySelectorAll("input[data-account-id]");
    const accounts = [];

    for (const input of inputs) {
        const normalizedValue = normalizeContributionValue(input.value);
        if (input.value.trim() && normalizedValue === null) {
            return null;
        }

        accounts.push({
            accountId: input.dataset.accountId,
            forecastedMonthlyContribution: normalizedValue
        });
    }

    return {accounts};
}

async function saveSettingsAccounts(payload) {
    const response = await fetch("/api/accounts/savings-planning", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(messages["savingsPlanningSettings.error.update"]);
    }

    renderSettingsAccounts(await response.json());
}

async function openSettingsModal(trigger) {
    if (!settingsModal || !settingsModalSubmitButton) {
        return;
    }

    settingsModalSubmitButton.disabled = true;
    renderSettingsEmpty(messages["savingsPlanningSettings.loading"] ?? "");
    settingsModal.open({trigger});

    try {
        await loadSettingsAccounts();
    } catch (error) {
        renderSettingsEmpty(error.message);
        showToastOnly(error.message, "error");
    } finally {
        settingsModalSubmitButton.disabled = false;
    }
}

function openGeneratorModal(trigger) {
    if (!generatorModal || !generatorModalForm || !generatorModalStartDateInput || !generatorModalSubmitButton) {
        return;
    }

    generatorModalForm.reset();
    generatorModalStartDateInput.value = todayIsoDate();
    generatorModalDurationSlider.value = "1";
    generatorModalSubmitButton.disabled = false;
    syncGeneratorDurationAriaValueText();
    syncGeneratorActiveRangeTick();
    syncGeneratorWarningText();
    generatorModal.open({trigger});
    requestAnimationFrame(layoutGeneratorRangeTicks);
}

function setTableColumnMetrics(columnCount) {
    tableElement.style.setProperty("--savings-forecast-column-count", String(Math.max(columnCount, 1)));
    stickyHeadTable.style.setProperty("--savings-forecast-column-count", String(Math.max(columnCount, 1)));
}

function measureTooltipWidth(text, maxWidth) {
    ensureTooltipMeasureElement();
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
    clearActiveForecastWarning();
    tableWrap.hidden = true;
    stickyHeadWrap.hidden = true;
    summaryElement.hidden = true;
    emptyState.hidden = false;
    deleteButton.disabled = true;
    generatedAtElement.textContent = "-";
    periodElement.textContent = "-";
    durationElement.textContent = "-";
    accountCountElement.textContent = "0";
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
    const response = await fetch("/api/savings-planning/forecasts/latest", {
        cache: "no-store"
    });
    if (response.status === 204) {
        clearActiveForecastWarning();
        renderEmptyState();
        return;
    }

    if (!response.ok) {
        clearActiveForecastWarning();
        throw new Error(messages["savingsPlanning.error.load"]);
    }

    const forecast = await response.json();
    if (forecast.forecastEndDate >= MoneySnapshotUi.localIsoDate()) {
        currentActiveForecast = forecast;
        syncGeneratorWarningText();
    } else {
        clearActiveForecastWarning();
    }
    renderForecastTable(forecast);
}

async function generateForecast(payload) {
    const response = await fetch("/api/savings-planning/forecasts", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(messages["savingsPlanningGenerator.error.generate"]);
    }
}

function handleGenerateButtonClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    event.preventDefault();
    openGeneratorModal(event.currentTarget);
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
        showToastOnly(error.message, "error");
    });
});

generateButtons.forEach((button) => {
    button.addEventListener("click", handleGenerateButtonClick);
});

settingsButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        event.preventDefault();
        openSettingsModal(event.currentTarget);
    });
});

generatorModalDurationSlider?.addEventListener("input", () => {
    syncGeneratorDurationAriaValueText();
    syncGeneratorActiveRangeTick();
});

generatorModalForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!generatorModalStartDateInput.value) {
        setMessage(messages["savingsPlanningGenerator.form.required"], "error");
        return;
    }

    generatorModalSubmitButton.disabled = true;
    setMessage("");

    try {
        await generateForecast({
            forecastStartDate: generatorModalStartDateInput.value,
            durationMonths: selectedGeneratorDurationMonths()
        });
        generatorModal.close();
        await loadLatestForecast();
        showToastOnly(messages["savingsPlanningGenerator.form.success"], "success");
    } catch (error) {
        showToastOnly(error.message, "error");
    } finally {
        generatorModalSubmitButton.disabled = false;
    }
});

settingsModalForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = collectSettingsPayload();
    if (!payload) {
        setMessage(messages["savingsPlanningSettings.form.required"], "error");
        return;
    }

    settingsModalSubmitButton.disabled = true;
    setMessage("");

    try {
        await saveSettingsAccounts(payload);
        settingsModal.close();
        showToastOnly(messages["savingsPlanningSettings.form.success"], "success");
    } catch (error) {
        showToastOnly(error.message, "error");
    } finally {
        settingsModalSubmitButton.disabled = false;
    }
});

tableWrap.addEventListener("scroll", syncStickyHeaderScroll, {passive: true});
window.addEventListener("resize", () => {
    syncStickyHeaderLayout();
    layoutGeneratorRangeTicks();
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
        showToastOnly(messages["savingsPlanning.delete.success"], "success");
    } catch (error) {
        deleteModal.close();
        deleteButton.disabled = currentForecast === null;
        showToastOnly(error.message, "error");
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
        syncGeneratorDurationAriaValueText();
        syncGeneratorActiveRangeTick();
        syncGeneratorWarningText();
        if (settingsAccountsLoaded) {
            renderSettingsAccounts(settingsAccounts);
        }
        rerender();
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
            ensureTooltipMeasureElement();
        })
        .then(() => {
            syncGeneratorDurationAriaValueText();
            syncGeneratorActiveRangeTick();
            requestAnimationFrame(layoutGeneratorRangeTicks);
        })
        .then(() => {
            showPendingNotification();
        })
        .then(loadLatestForecast)
        .catch((error) => {
            setMessage(error.message, "error");
            renderEmptyState();
        });
