const scopeTabs = document.querySelectorAll(".report-scope-tab");
const overviewTabs = document.querySelectorAll(".overview-tab");
const periodSelect = document.querySelector("#report-period");
const dateFromInput = document.querySelector("#report-date-from");
const dateToInput = document.querySelector("#report-date-to");
const customPeriodFields = document.querySelectorAll(".custom-period-field");
const refreshButton = document.querySelector("#refresh-reports");
const clearReportsCacheButton = document.querySelector("#clear-reports-cache");
const messageElement = document.querySelector("#reports-message");
const chartElement = document.querySelector("#reports-chart");
const tableBody = document.querySelector("#reports-table-body");
const overviewMessageElement = document.querySelector("#overview-message");
const overviewChartElement = document.querySelector("#overview-chart");
const overviewTableBody = document.querySelector("#overview-table-body");
const averageContributionsMessageElement = document.querySelector("#average-contributions-message");
const averageContributionsTableBody = document.querySelector("#average-contributions-table-body");
const averageContributionsTableFoot = document.querySelector("#average-contributions-table-foot");
const planningMessageElement = document.querySelector("#planning-message");
const planningSummaryElement = document.querySelector("#planning-summary");
const planningTableBody = document.querySelector("#planning-table-body");
const planningTableFoot = document.querySelector("#planning-table-foot");
const reportScopeTabs = document.querySelector("#report-scope-tabs");
const overviewScopeTabs = document.querySelector("#overview-scope-tabs");
const historyPeriodSelect = document.querySelector("#history-period");
const historyDateFromInput = document.querySelector("#history-date-from");
const historyDateToInput = document.querySelector("#history-date-to");
const historyCustomPeriodFields = document.querySelectorAll(".history-custom-period-field");
const refreshHistoryButton = document.querySelector("#refresh-history");
const historyMessageElement = document.querySelector("#history-message");
const historyPreviousPageButton = document.querySelector("#history-prev-page");
const historyNextPageButton = document.querySelector("#history-next-page");
const historyPageInfo = document.querySelector("#history-page-info");
const historyPageSizeSelect = document.querySelector("#history-page-size");
const historyPaginationElement = document.querySelector("#history-pagination");
const historyTableHeadRow = document.querySelector("#history-table-head-row");
const historyTableBody = document.querySelector("#history-table-body");
const reportsNavElement = document.querySelector(".reports-nav");
const reportsNavLinks = document.querySelectorAll(".reports-nav a[data-target]");
const reportsNavPanel = document.querySelector(".reports-nav-panel");
const reportFilterButtons = document.querySelectorAll(".report-filter-button");
const reportPdfButtons = document.querySelectorAll(".report-pdf-button[data-report-section]");
const reportsNavStickyMedia = window.matchMedia("(min-width: 861px)");
const toastManager = MoneySnapshotUi.createToastManager({
    durationMs: 5000
});

const periodOffsets = {
    "1m": {months: 1},
    "2m": {months: 2},
    "3m": {months: 3},
    "6m": {months: 6},
    "1y": {years: 1},
    "2y": {years: 2}
};
const MAX_HISTORY_RANGE_DAYS = 732;
const MAX_REPORT_PDF_TABLE_ROWS = 2000;
const HISTORY_PDF_EXPORT_PAGE_SIZE = 100;

let currentLanguage = "pl";
let messages = {};
let currentScope = "accounts";
let currentOverviewScope = "accounts";
let currentHistoryPage = 0;
let reportsNavStickyEnabled = reportsNavStickyMedia.matches;
let reportsNavStickyFramePending = false;
let userSettings = null;
const reportPdfData = {};

const reportSections = {
    summary: {
        element: document.querySelector("#reports-summary-section"),
        dirty: true,
        loading: false,
        visible: false
    },
    overview: {
        element: document.querySelector("#reports-overview-section"),
        dirty: true,
        loading: false,
        visible: false
    },
    averageContributions: {
        element: document.querySelector("#reports-average-contributions-section"),
        dirty: true,
        loading: false,
        visible: false
    },
    planning: {
        element: document.querySelector("#reports-planning-section"),
        dirty: true,
        loading: false,
        visible: false
    },
    history: {
        element: document.querySelector("#reports-history-section"),
        dirty: true,
        loading: false,
        visible: false
    }
};
const reportSectionKeys = Object.keys(reportSections);

function locale() {
    return currentLanguage === "en" ? "en-US" : "pl-PL";
}

function todayIsoDate() {
    return MoneySnapshotUi.localIsoDate();
}

function shiftDate(date, offset) {
    const shiftedDate = new Date(`${date}T00:00:00Z`);
    shiftedDate.setUTCFullYear(shiftedDate.getUTCFullYear() - (offset.years ?? 0));
    shiftedDate.setUTCMonth(shiftedDate.getUTCMonth() - (offset.months ?? 0));
    return shiftedDate.toISOString().slice(0, 10);
}

function addDays(date, days) {
    const nextDate = new Date(`${date}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + days);
    return nextDate.toISOString().slice(0, 10);
}

function addMonths(date, months) {
    const nextDate = new Date(`${date}T00:00:00Z`);
    const originalDay = nextDate.getUTCDate();
    nextDate.setUTCDate(1);
    nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
    const lastDayOfTargetMonth = new Date(Date.UTC(
            nextDate.getUTCFullYear(),
            nextDate.getUTCMonth() + 1,
            0
    )).getUTCDate();
    nextDate.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
    return nextDate.toISOString().slice(0, 10);
}

function periodStartDateForBillingCycle(today, billingMonthEndDay) {
    const normalizedEndDay = Math.max(1, Math.min(31, billingMonthEndDay));
    const currentDate = new Date(`${today}T00:00:00Z`);
    const currentMonthEnd = new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth(),
            Math.min(normalizedEndDay, new Date(Date.UTC(
                    currentDate.getUTCFullYear(),
                    currentDate.getUTCMonth() + 1,
                    0
            )).getUTCDate())
    ));

    if (today > currentMonthEnd.toISOString().slice(0, 10)) {
        return addDays(currentMonthEnd.toISOString().slice(0, 10), 1);
    }

    const previousMonthDate = new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth() - 1,
            1
    ));
    previousMonthDate.setUTCDate(Math.min(normalizedEndDay, new Date(Date.UTC(
            previousMonthDate.getUTCFullYear(),
            previousMonthDate.getUTCMonth() + 1,
            0
    )).getUTCDate()));
    return addDays(previousMonthDate.toISOString().slice(0, 10), 1);
}

function periodEndDateForBillingCycleStart(periodStartDate, billingMonthEndDay) {
    const normalizedEndDay = Math.max(1, Math.min(31, billingMonthEndDay));
    const startDate = new Date(`${periodStartDate}T00:00:00Z`);
    const currentMonthEnd = new Date(Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            Math.min(normalizedEndDay, new Date(Date.UTC(
                    startDate.getUTCFullYear(),
                    startDate.getUTCMonth() + 1,
                    0
            )).getUTCDate())
    ));

    if (currentMonthEnd.toISOString().slice(0, 10) >= periodStartDate) {
        return currentMonthEnd.toISOString().slice(0, 10);
    }

    const nextMonthEnd = new Date(Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth() + 1,
            1
    ));
    nextMonthEnd.setUTCDate(Math.min(normalizedEndDay, new Date(Date.UTC(
            nextMonthEnd.getUTCFullYear(),
            nextMonthEnd.getUTCMonth() + 1,
            0
    )).getUTCDate()));
    return nextMonthEnd.toISOString().slice(0, 10);
}

function billingRange() {
    const today = todayIsoDate();
    const billingMonthEndDay = Math.max(1, Math.min(userSettings?.billingMonthStartDay ?? 1, 31));
    const periodStartDate = periodStartDateForBillingCycle(today, billingMonthEndDay);
    return {
        fromDate: periodStartDate,
        toDate: periodEndDateForBillingCycleStart(periodStartDate, billingMonthEndDay)
    };
}

function daysBetweenInclusive(fromDate, toDate) {
    const fromTime = new Date(`${fromDate}T00:00:00Z`).getTime();
    const toTime = new Date(`${toDate}T00:00:00Z`).getTime();
    return Math.floor((toTime - fromTime) / 86400000) + 1;
}

function validateHistoryRange(fromDate, toDate) {
    if (!fromDate || !toDate || fromDate > toDate) {
        throw new Error(messages["reports.error.customRange"]);
    }

    if (daysBetweenInclusive(fromDate, toDate) > MAX_HISTORY_RANGE_DAYS) {
        throw new Error((messages["reports.error.historyRangeTooLarge"] ?? "")
                .replace("{days}", String(MAX_HISTORY_RANGE_DAYS)));
    }
}

function resolveDateRange() {
    if (periodSelect.value === "custom") {
        const fromDate = dateFromInput.value;
        const toDate = dateToInput.value;
        if (!fromDate || !toDate || fromDate > toDate) {
            throw new Error(messages["reports.error.customRange"]);
        }

        return {fromDate, toDate};
    }

    if (periodSelect.value === "billing") {
        return billingRange();
    }

    const toDate = todayIsoDate();
    return {
        fromDate: shiftDate(toDate, periodOffsets[periodSelect.value]),
        toDate
    };
}

function syncRangeInputs(periodValue, resolveRange, fromInput, toInput) {
    if (periodValue === "custom") {
        return;
    }

    const range = resolveRange();
    fromInput.value = range.fromDate;
    toInput.value = range.toDate;
}

function formatDate(value) {
    return MoneySnapshotUi.formatDateValue(value, userSettings);
}

function formatAmount(value) {
    return MoneySnapshotUi.formatMoneyValue(value, userSettings);
}

function displayRangeLabel(range, periodValue) {
    return `${formatDate(range.fromDate)} - ${formatDate(range.toDate)}`;
}

function formatChange(value) {
    const numericValue = Number(value);
    const sign = numericValue > 0 ? "+" : "";
    return `${sign}${formatAmount(numericValue)}`;
}

function formatPercent(value) {
    if (value === null || value === undefined) {
        return "-";
    }

    const numericValue = Number(value);
    const sign = numericValue > 0 ? "+" : "";
    return `${sign}${numericValue.toFixed(1)}%`;
}

function formatChangeWithOptionalPercent(change, percent) {
    if (change === null || change === undefined) {
        return messages["reports.planning.noData"] ?? "brak danych";
    }

    const changeLabel = formatChange(change);
    if (percent === null || percent === undefined) {
        return changeLabel;
    }

    return `${changeLabel} · ${formatPercent(percent)}`;
}

function escapeHtml(value) {
    return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#39;");
}

function createPdfIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");

    [
        "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z",
        "M14 2v6h6",
        "M8 13h2a2 2 0 0 1 0 4H8v-4Z",
        "M14 13v4",
        "M17 13h-3"
    ].forEach((value) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", value);
        icon.append(path);
    });

    return icon;
}

function createFilterIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");

    [
        "M3 6h18",
        "M7 12h10",
        "M10 18h4"
    ].forEach((value) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", value);
        icon.append(path);
    });

    return icon;
}

function closeReportFilterMenus(exceptButton = null, restoreFocus = false) {
    reportFilterButtons.forEach((button) => {
        if (button === exceptButton) {
            return;
        }
        const popover = button.closest(".report-filter-menu")?.querySelector(".report-filter-popover");
        const shouldRestoreFocus = restoreFocus
                && popover
                && document.activeElement instanceof Element
                && popover.contains(document.activeElement);
        button.setAttribute("aria-expanded", "false");
        if (popover) {
            popover.hidden = true;
        }
        if (shouldRestoreFocus) {
            button.focus();
        }
    });
}

function toggleReportFilterMenu(button) {
    const popover = button.closest(".report-filter-menu")?.querySelector(".report-filter-popover");
    if (!popover) {
        return;
    }

    const shouldOpen = popover.hidden;
    closeReportFilterMenus(button);
    popover.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
}

function setMessage(text, type = "") {
    messageElement.textContent = text;
    messageElement.dataset.type = type;
}

function setHistoryMessage(text, type = "") {
    historyMessageElement.textContent = text;
    historyMessageElement.dataset.type = type;
}

function setOverviewMessage(text, type = "") {
    overviewMessageElement.textContent = text;
    overviewMessageElement.dataset.type = type;
}

function setAverageContributionsMessage(text, type = "") {
    averageContributionsMessageElement.textContent = text;
    averageContributionsMessageElement.dataset.type = type;
}

function setPlanningMessage(text, type = "") {
    planningMessageElement.textContent = text;
    planningMessageElement.dataset.type = type;
}

function updateReportsNavActiveState() {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    let activeTarget = "";
    let largestVisibleHeight = 0;
    let nearestTarget = "";
    let nearestDistance = Number.POSITIVE_INFINITY;
    const viewportCenterY = viewportHeight / 2;

    reportsNavLinks.forEach((link) => {
        const targetId = link.dataset.target ?? "";
        const section = document.getElementById(targetId);
        if (!section) {
            return;
        }

        const rect = section.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, 0);
        const visibleBottom = Math.min(rect.bottom, viewportHeight);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const sectionCenterY = rect.top + (rect.height / 2);
        const distanceToCenter = Math.abs(sectionCenterY - viewportCenterY);

        if (visibleHeight > largestVisibleHeight) {
            largestVisibleHeight = visibleHeight;
            activeTarget = targetId;
        }

        if (distanceToCenter < nearestDistance) {
            nearestDistance = distanceToCenter;
            nearestTarget = targetId;
        }
    });

    if (!activeTarget) {
        activeTarget = nearestTarget;
    }

    reportsNavLinks.forEach((link) => {
        link.classList.toggle("is-active", (link.dataset.target ?? "") === activeTarget);
    });
}

function updateReportsNavPanelStickyState() {
    if (!reportsNavPanel) {
        return;
    }

    const topbarElement = document.querySelector(".topbar");
    const stickyTop = topbarElement ? topbarElement.getBoundingClientRect().height + 12 : 0;
    const rect = reportsNavPanel.getBoundingClientRect();
    reportsNavPanel.classList.toggle("is-stuck", reportsNavStickyEnabled && rect.top <= stickyTop);
}

function updateReportsNavStickyOffset() {
    const topbarElement = document.querySelector(".topbar");
    const stickyTop = topbarElement ? topbarElement.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--reports-nav-sticky-top", `${Math.round(stickyTop)}px`);
}

function scheduleReportsNavPanelStickyStateUpdate() {
    if (reportsNavStickyFramePending) {
        return;
    }

    reportsNavStickyFramePending = true;
    window.requestAnimationFrame(() => {
        reportsNavStickyFramePending = false;
        updateReportsNavPanelStickyState();
    });
}

function handleReportsNavResize() {
    reportsNavStickyEnabled = reportsNavStickyMedia.matches;
    updateReportsNavStickyOffset();
    updateReportsNavActiveState();
    scheduleReportsNavPanelStickyStateUpdate();
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
    chartElement.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
}

function renderTable(rows) {
    tableBody.replaceChildren(...rows.map((row) => {
        const tableRow = document.createElement("tr");
        [
            row.name,
            row.currencyCode,
            formatAmount(row.startBalance),
            formatAmount(row.endBalance),
            formatChange(row.change),
            formatPercent(row.changePercent)
        ].forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (index >= 2) {
                cell.className = "numeric-cell";
            }
            tableRow.append(cell);
        });
        return tableRow;
    }));
}

function renderOverviewTable(rows) {
    overviewTableBody.replaceChildren(...rows.map((row) => {
        const tableRow = document.createElement("tr");
        [
            row.name,
            row.currencyCode,
            formatAmount(row.balance),
            formatPercent(row.sharePercent)
        ].forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (index >= 2) {
                cell.className = "numeric-cell";
            }
            tableRow.append(cell);
        });
        return tableRow;
    }));
}

function renderHistoryTable(matrix) {
    historyTableHeadRow.replaceChildren();
    const dateHead = document.createElement("th");
    dateHead.scope = "col";
    dateHead.textContent = messages["reports.history.date"] ?? "Date";
    historyTableHeadRow.append(dateHead);
    matrix.accounts.forEach((account) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.className = "history-account-head";
        th.innerHTML = `
            <span>${escapeHtml(account.accountName)}</span>
            <span>${escapeHtml(`${account.bankName}, ${account.currencyCode}`)}</span>
        `;
        historyTableHeadRow.append(th);
    });

    historyTableBody.replaceChildren(...matrix.rows.map((row) => {
        const tableRow = document.createElement("tr");
        const dateCell = document.createElement("td");
        dateCell.className = "history-date-cell";
        dateCell.textContent = formatDate(row.date);
        tableRow.append(dateCell);

        row.values.forEach((value) => {
            const cell = document.createElement("td");
            cell.className = "history-value-cell numeric-cell";
            if (value) {
                cell.innerHTML = `
                    <span>${escapeHtml(formatAmount(value.balance))}</span>
                    <span>${escapeHtml(formatChange(value.diff))}</span>
                `;
            } else {
                cell.innerHTML = `
                    <span>-</span>
                    <span>-</span>
                `;
            }
            tableRow.append(cell);
        });
        return tableRow;
    }));
}

function renderOverviewEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = message;
    row.append(cell);
    overviewTableBody.replaceChildren(row);
    overviewChartElement.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
}

function renderHistoryEmpty(message) {
    historyTableHeadRow.replaceChildren();
    const dateHead = document.createElement("th");
    dateHead.scope = "col";
    dateHead.textContent = messages["reports.history.date"] ?? "Date";
    historyTableHeadRow.append(dateHead);
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 1;
    cell.textContent = message;
    row.append(cell);
    historyTableBody.replaceChildren(row);
    historyPageInfo.textContent = "-";
    historyPreviousPageButton.disabled = true;
    historyNextPageButton.disabled = true;
}

function linePath(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function chartDateLabel(date, step) {
    const options = step === "month"
            ? {month: "short", year: "numeric"}
            : {day: "2-digit", month: "2-digit"};

    return new Intl.DateTimeFormat(locale(), options).format(new Date(`${date}T00:00:00Z`));
}

function visibleAxisDates(checkpoints) {
    if (checkpoints.length <= 5) {
        return checkpoints;
    }

    const step = Math.ceil((checkpoints.length - 1) / 4);
    return checkpoints.filter((date, index) => index === 0 || index === checkpoints.length - 1 || index % step === 0);
}

function pieSlicePath(cx, cy, radius, startAngle, endAngle) {
    const startX = cx + radius * Math.cos(startAngle);
    const startY = cy + radius * Math.sin(startAngle);
    const endX = cx + radius * Math.cos(endAngle);
    const endY = cy + radius * Math.sin(endAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
}

function pieSliceMarkup(cx, cy, radius, startAngle, endAngle, share, index) {
    const attributes = `data-overview-index="${index}" style="--chart-color: ${chartColor(index)}"`;
    if (share >= 0.999999) {
        return `<circle cx="${cx}" cy="${cy}" r="${radius}" ${attributes}></circle>`;
    }

    return `<path d="${pieSlicePath(cx, cy, radius, startAngle, endAngle)}" ${attributes}></path>`;
}

function chartColor(index) {
    return [
        "#0f8b8d",
        "#a33b2f",
        "#4666d8",
        "#7c5a1b",
        "#5f4bb6",
        "#247a3d",
        "#c05a14",
        "#455a64"
    ][index % 8];
}

function renderChart(rows, step, checkpoints) {
    if (rows.length === 0) {
        chartElement.innerHTML = `<div class="chart-empty">${escapeHtml(messages["reports.chart.empty"])}</div>`;
        return;
    }

    const chartStartDate = rows
            .flatMap((row) => row.series.map((point) => point.date))
            .sort((left, right) => left.localeCompare(right))[0] ?? checkpoints[0];
    const startTime = new Date(`${chartStartDate}T00:00:00Z`).getTime();
    const endTime = new Date(`${checkpoints.at(-1)}T00:00:00Z`).getTime();
    const timeRange = endTime - startTime || 1;
    const allChanges = rows.flatMap((row) => row.series.map((point) => point.change));
    const minChange = Math.min(...allChanges, 0);
    const maxChange = Math.max(...allChanges, 0);
    const changeRange = maxChange - minChange || 1;
    const width = 560;
    const height = 156;
    const leftPadding = 42;
    const rightPadding = 10;
    const topPadding = 12;
    const bottomPadding = 26;
    const plotWidth = width - leftPadding - rightPadding;
    const plotHeight = height - topPadding - bottomPadding;
    const zeroY = topPadding + ((maxChange - 0) * plotHeight) / changeRange;
    const axisDates = visibleAxisDates(checkpoints);

    function xForDate(date) {
        const time = new Date(`${date}T00:00:00Z`).getTime();
        return leftPadding + ((time - startTime) * plotWidth) / timeRange;
    }

    function yForChange(change) {
        return topPadding + ((maxChange - change) * plotHeight) / changeRange;
    }

    const axisLabels = axisDates.map((date) => `
        <text class="report-chart-axis-label" x="${xForDate(date)}" y="${height - 8}" text-anchor="middle">${escapeHtml(chartDateLabel(date, step))}</text>
    `).join("");

    const lines = rows.map((row, index) => {
        const color = chartColor(index);
        const points = row.series.map((point) => ({
            ...point,
            x: xForDate(point.date),
            y: yForChange(point.change)
        }));
        return `
            <path class="report-chart-line" d="${linePath(points)}" style="--chart-color: ${color}"></path>
            ${row.points.map((point) => `<circle class="report-chart-point" cx="${xForDate(point.date)}" cy="${yForChange(point.change)}" r="2" style="--chart-color: ${color}"></circle>`).join("")}
        `;
    }).join("");

    const legend = rows.map((row, index) => {
        const color = chartColor(index);
        return `
            <li class="report-chart-legend-item">
                <span class="report-chart-swatch" style="--chart-color: ${color}"></span>
                <span class="report-chart-legend-name">${escapeHtml(row.name)}</span>
                <span class="report-chart-legend-value">${escapeHtml(formatChange(row.change))}</span>
            </li>
        `;
    }).join("");

    chartElement.innerHTML = `
        <div class="report-chart-layout">
            <ul class="report-chart-legend">${legend}</ul>
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(messages["reports.chart.aria.changes"])}">
                <line class="report-chart-zero" x1="${leftPadding}" x2="${width - rightPadding}" y1="${zeroY}" y2="${zeroY}"></line>
                <text class="report-chart-axis-label" x="${leftPadding - 7}" y="${zeroY + 3}" text-anchor="end">0</text>
                ${axisLabels}
                ${lines}
            </svg>
        </div>
    `;
}

function renderAverageContributionsEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = message;
    row.append(cell);
    averageContributionsTableBody.replaceChildren(row);
    averageContributionsTableFoot.replaceChildren();
}

function renderAverageContributions(rows, totals) {
    averageContributionsTableBody.replaceChildren(...rows.map((row) => {
        const tableRow = document.createElement("tr");
        const nameCell = document.createElement("td");
        const bankCell = document.createElement("td");
        const currencyCell = document.createElement("td");
        const averageCell = document.createElement("td");

        nameCell.textContent = row.name;
        bankCell.textContent = row.bankName;
        currencyCell.textContent = row.currencyCode;
        averageCell.className = "numeric-cell";
        averageCell.textContent = formatChange(row.averageContribution);

        if (row.sampleFromDate && row.sampleToDate) {
            const sampleRange = `${formatDate(row.sampleFromDate)} - ${formatDate(row.sampleToDate)}`;
            averageCell.setAttribute("aria-label", `${averageCell.textContent}. ${sampleRange}`);
            MoneySnapshotUi.setTooltip(averageCell, sampleRange);
        }

        tableRow.append(nameCell, bankCell, currencyCell, averageCell);
        return tableRow;
    }));

    averageContributionsTableFoot.replaceChildren(...totals.map((total) => {
        const tableRow = document.createElement("tr");
        tableRow.className = "average-contributions-total-row";

        const labelCell = document.createElement("td");
        labelCell.colSpan = 3;
        labelCell.textContent = `${messages["reports.average.total"] ?? "Średnia dla wszystkich kont"} [${total.currencyCode}]`;

        const valueCell = document.createElement("td");
        valueCell.className = "numeric-cell";
        valueCell.textContent = formatChange(total.averageContribution);

        tableRow.append(labelCell, valueCell);
        return tableRow;
    }));
}

function renderPlanningEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = message;
    row.append(cell);
    planningTableBody.replaceChildren(row);
    planningTableFoot.replaceChildren();
    planningSummaryElement.replaceChildren();
}

function renderPlanningSummary(totals) {
    planningSummaryElement.replaceChildren(...totals.map((total) => {
        const card = document.createElement("article");
        card.className = "planning-summary-card";
        card.innerHTML = `
            <p class="planning-summary-card-title">${escapeHtml(total.currencyCode)}</p>
            <dl class="planning-summary-card-values">
                <div>
                    <dt>${escapeHtml(messages["reports.planning.current"] ?? "Obecne środki")}</dt>
                    <dd>${escapeHtml(total.currentBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.currentBalance))}</dd>
                </div>
                <div>
                    <dt>${escapeHtml(messages["reports.planning.currentPlan"] ?? "Obecnie według planu")}</dt>
                    <dd>${escapeHtml(total.currentPlannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.currentPlannedBalance))}</dd>
                </div>
                <div>
                    <dt>${escapeHtml(messages["reports.planning.currentDiff"] ?? "Różnica teraz")}</dt>
                    <dd>${escapeHtml(total.currentDifferenceToPlan === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(total.currentDifferenceToPlan))}</dd>
                </div>
                <div>
                    <dt>${escapeHtml(messages["reports.planning.yearTarget"] ?? "Za rok")}</dt>
                    <dd>${escapeHtml(total.projectedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.projectedBalance))}</dd>
                </div>
                <div>
                    <dt>${escapeHtml(messages["reports.planning.yearChange"] ?? "Zmiana roczna")}</dt>
                    <dd>${escapeHtml(formatChangeWithOptionalPercent(total.yearlyChange, total.projectedChangePercent))}</dd>
                </div>
                <div>
                    <dt>${escapeHtml(messages["reports.planning.planTarget"] ?? "Według planu")}</dt>
                    <dd>${escapeHtml(total.plannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.plannedBalance))}</dd>
                </div>
            </dl>
        `;
        return card;
    }));
}

function renderPlanning(rows, totals) {
    planningTableBody.replaceChildren(...rows.map((row) => {
        const tableRow = document.createElement("tr");
        const accountCell = document.createElement("td");
        accountCell.className = "planning-account-cell";
        accountCell.innerHTML = `
            <span class="planning-account-name">${escapeHtml(row.name)}</span>
            <span class="planning-account-meta">${escapeHtml(`${row.bankName} · ${row.currencyCode}`)}</span>
        `;

        const values = [
            row.currentBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.currentBalance),
            row.currentPlannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.currentPlannedBalance),
            row.currentDifferenceToPlan === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(row.currentDifferenceToPlan),
            row.averageContribution === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(row.averageContribution),
            row.projectedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.projectedBalance),
            row.plannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.plannedBalance),
            row.differenceToPlan === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(row.differenceToPlan)
        ];

        tableRow.append(accountCell);
        values.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            cell.className = "numeric-cell";
            tableRow.append(cell);
        });
        return tableRow;
    }));

    planningTableFoot.replaceChildren(...totals.map((total) => {
        const tableRow = document.createElement("tr");
        tableRow.className = "planning-total-row";

        const labelCell = document.createElement("td");
        labelCell.textContent = `${messages["reports.planning.total"] ?? "Plan łączny"} [${total.currencyCode}]`;

        const currentCell = document.createElement("td");
        currentCell.className = "numeric-cell";
        currentCell.textContent = total.currentBalance === null
                ? (messages["reports.planning.noData"] ?? "brak danych")
                : formatAmount(total.currentBalance);

        const currentPlannedCell = document.createElement("td");
        currentPlannedCell.className = "numeric-cell";
        currentPlannedCell.textContent = total.currentPlannedBalance === null
                ? (messages["reports.planning.noData"] ?? "brak danych")
                : formatAmount(total.currentPlannedBalance);

        const currentDifferenceCell = document.createElement("td");
        currentDifferenceCell.className = "numeric-cell";
        currentDifferenceCell.textContent = total.currentDifferenceToPlan === null
                ? (messages["reports.planning.noData"] ?? "brak danych")
                : formatChange(total.currentDifferenceToPlan);

        const monthlyCell = document.createElement("td");
        monthlyCell.className = "numeric-cell";
        monthlyCell.textContent = total.averageContribution === null
                ? (messages["reports.planning.noData"] ?? "brak danych")
                : formatChange(total.averageContribution);

        const projectedCell = document.createElement("td");
        projectedCell.className = "numeric-cell";
        projectedCell.textContent = total.projectedBalance === null
                ? (messages["reports.planning.noData"] ?? "brak danych")
                : formatAmount(total.projectedBalance);

        const plannedCell = document.createElement("td");
        plannedCell.className = "numeric-cell";
        plannedCell.textContent = total.plannedBalance === null
                ? (messages["reports.planning.noData"] ?? "brak danych")
                : formatAmount(total.plannedBalance);

        const differenceCell = document.createElement("td");
        differenceCell.className = "numeric-cell";
        differenceCell.textContent = total.differenceToPlan === null
                ? (messages["reports.planning.noData"] ?? "brak danych")
                : formatChange(total.differenceToPlan);

        tableRow.append(
                labelCell,
                currentCell,
                currentPlannedCell,
                currentDifferenceCell,
                monthlyCell,
                projectedCell,
                plannedCell,
                differenceCell
        );
        return tableRow;
    }));

    renderPlanningSummary(totals);
}

function renderOverviewChart(rows) {
    if (rows.length === 0) {
        overviewChartElement.innerHTML = `<div class="chart-empty">${escapeHtml(messages["reports.overview.empty"])}</div>`;
        return;
    }

    const total = rows.reduce((sum, row) => sum + Math.abs(row.balance), 0);
    const radius = 42;
    const centerX = 68;
    const centerY = 52;
    let angle = -Math.PI / 2;

    const slices = rows.map((row, index) => {
        const share = total === 0 ? 0 : Math.abs(row.balance) / total;
        const nextAngle = angle + share * Math.PI * 2;
        const slice = pieSliceMarkup(centerX, centerY, radius, angle, nextAngle, share, index);
        angle = nextAngle;
        return slice;
    }).join("");

    const legend = rows.map((row, index) => `
        <li class="report-chart-legend-item" data-overview-index="${index}">
            <span class="report-chart-swatch" style="--chart-color: ${chartColor(index)}"></span>
            <span class="report-chart-legend-name">${escapeHtml(`${row.name} (${row.currencyCode})`)}</span>
            <span class="report-chart-legend-value">${escapeHtml(formatPercent(row.sharePercent))}</span>
        </li>
    `).join("");

    overviewChartElement.innerHTML = `
        <div class="report-chart-layout">
            <ul class="report-chart-legend">${legend}</ul>
            <svg viewBox="0 0 180 112" role="img" aria-label="${escapeHtml(messages["reports.chart.aria.overview"])}">
                <g class="overview-pie-chart">${slices}</g>
            </svg>
        </div>
    `;

    const sliceElements = overviewChartElement.querySelectorAll(".overview-pie-chart [data-overview-index]");
    const legendElements = overviewChartElement.querySelectorAll(".report-chart-legend-item[data-overview-index]");

    function setActiveOverviewIndex(activeIndex) {
        legendElements.forEach((element) => {
            element.classList.toggle("is-active", element.dataset.overviewIndex === activeIndex);
        });
        sliceElements.forEach((element) => {
            element.classList.toggle("is-active", element.dataset.overviewIndex === activeIndex);
        });
    }

    sliceElements.forEach((sliceElement) => {
        sliceElement.addEventListener("mouseenter", () => {
            setActiveOverviewIndex(sliceElement.dataset.overviewIndex ?? "");
        });
        sliceElement.addEventListener("mouseleave", () => {
            setActiveOverviewIndex("");
        });
    });
}

function renderOverview(rawRows) {
    setOverviewMessage("");
    if (rawRows.length === 0) {
        clearReportPdfData("overview");
        renderOverviewEmpty(messages["reports.overview.empty"]);
        return;
    }

    const totalMagnitude = rawRows.reduce((sum, row) => sum + Math.abs(row.balance), 0);

    const rows = rawRows.map((row) => {
        return {
            ...row,
            sharePercent: totalMagnitude === 0 ? null : (Math.abs(row.balance) * 100) / totalMagnitude
        };
    });

    reportPdfData.overview = {
        title: messages["reports.overview.title"],
        subtitle: currentOverviewScope === "banks" ? messages["reports.scope.banks"] : messages["reports.scope.accounts"],
        chartType: "pie",
        chart: {
            rows,
            otherLabel: messages["reports.overview.other"]
        },
        table: {
            columns: [
                messages["reports.table.name"],
                messages["reports.table.currency"],
                messages["reports.overview.balance"],
                messages["reports.overview.share"]
            ],
            rows: rows.map((row) => [
                row.name,
                row.currencyCode,
                formatAmount(row.balance),
                formatPercent(row.sharePercent)
            ])
        }
    };
    renderOverviewTable(rows);
    renderOverviewChart(rows);
}

function resolveHistoryRange() {
    if (historyPeriodSelect.value === "custom") {
        const fromDate = historyDateFromInput.value;
        const toDate = historyDateToInput.value;
        validateHistoryRange(fromDate, toDate);

        return {fromDate, toDate};
    }

    if (historyPeriodSelect.value === "billing") {
        return billingRange();
    }

    const toDate = todayIsoDate();
    return {
        fromDate: shiftDate(toDate, periodOffsets[historyPeriodSelect.value]),
        toDate
    };
}

function renderHistoryPagination(pageData) {
    if (!pageData) {
        historyPageInfo.textContent = "-";
        historyPreviousPageButton.disabled = true;
        historyNextPageButton.disabled = true;
        return;
    }

    const pageNumber = pageData.totalElements === 0 ? 0 : pageData.page + 1;
    const template = messages["reports.history.pagination.info"] ?? "";
    historyPageInfo.textContent = template
            .replace("{page}", pageNumber)
            .replace("{totalPages}", pageData.totalPages)
            .replace("{totalElements}", pageData.totalElements);
    historyPreviousPageButton.disabled = pageData.first || pageData.totalElements === 0;
    historyNextPageButton.disabled = pageData.last || pageData.totalElements === 0;
}

function updateCustomPeriodVisibility() {
    syncRangeInputs(periodSelect.value, resolveDateRange, dateFromInput, dateToInput);
    const isCustom = periodSelect.value === "custom";
    customPeriodFields.forEach((field) => {
        field.hidden = !isCustom;
    });
}

function updateHistoryCustomPeriodVisibility() {
    syncRangeInputs(historyPeriodSelect.value, resolveHistoryRange, historyDateFromInput, historyDateToInput);
    const isCustom = historyPeriodSelect.value === "custom";
    historyCustomPeriodFields.forEach((field) => {
        field.hidden = !isCustom;
    });
}

function markReportSectionsDirty(keys = reportSectionKeys) {
    keys.forEach((key) => {
        if (reportSections[key]) {
            reportSections[key].dirty = true;
        }
    });
}

function reportSectionKeyForElement(element) {
    return reportSectionKeys.find((key) => reportSections[key].element === element);
}

function clearReportPdfData(key) {
    if (!key) {
        Object.keys(reportPdfData).forEach((entryKey) => delete reportPdfData[entryKey]);
        return;
    }
    delete reportPdfData[key];
}

async function fetchReportJson(url) {
    const response = await fetch(url, {cache: "no-store"});
    if (!response.ok) {
        throw new Error(messages["reports.error.load"] ?? "Cannot load report.");
    }

    return response.json();
}

async function clearReportsCache() {
    const response = await fetch("/api/reports/cache/clear", {
        method: "POST",
        cache: "no-store"
    });
    if (!response.ok) {
        throw new Error(messages["reports.error.clearCache"] ?? messages["reports.error.load"] ?? "Cannot clear report cache.");
    }
}

async function renderSummaryReportSection() {
    const range = resolveDateRange();
    const baselineDate = periodSelect.value === "billing" ? addDays(range.fromDate, -1) : null;
    const baselineQuery = baselineDate ? `&baselineDate=${encodeURIComponent(baselineDate)}` : "";
    const summary = await fetchReportJson(`/api/reports/summary?scope=${encodeURIComponent(currentScope)}&fromDate=${encodeURIComponent(range.fromDate)}&toDate=${encodeURIComponent(range.toDate)}${baselineQuery}`);
    setMessage("");
    setMessage(displayRangeLabel(range, periodSelect.value));

    if (!summary.rows || summary.rows.length === 0) {
        clearReportPdfData("summary");
        renderEmpty(messages["reports.empty"]);
        return;
    }

    reportPdfData.summary = {
        title: messages["reports.table.title"],
        subtitle: displayRangeLabel(range, periodSelect.value),
        chartType: "line",
        chart: {rows: summary.rows, checkpoints: summary.checkpoints},
        table: {
            columns: [
                messages["reports.table.name"],
                messages["reports.table.currency"],
                messages["reports.table.start"],
                messages["reports.table.end"],
                messages["reports.table.change"],
                messages["reports.table.percent"]
            ],
            rows: summary.rows.map((row) => [
                row.name,
                row.currencyCode,
                formatAmount(row.startBalance),
                formatAmount(row.endBalance),
                formatChange(row.change),
                formatPercent(row.changePercent)
            ])
        }
    };
    renderChart(summary.rows, summary.step, summary.checkpoints);
    renderTable(summary.rows);
}

async function renderOverviewReportSection() {
    const overview = await fetchReportJson(`/api/reports/overview?scope=${encodeURIComponent(currentOverviewScope)}&toDate=${encodeURIComponent(todayIsoDate())}`);
    renderOverview(overview.rows ?? []);
}

async function renderAverageContributionsReportSection() {
    const averageContributionReport = await fetchReportJson("/api/reports/average-contributions");
    if (averageContributionReport.rows.length === 0) {
        clearReportPdfData("averageContributions");
        renderAverageContributionsEmpty(messages["reports.average.empty"]);
        setAverageContributionsMessage(messages["reports.average.hint"] ?? "");
        return;
    }

    reportPdfData.averageContributions = {
        title: messages["reports.average.title"],
        subtitle: messages["reports.average.hint"] ?? "",
        table: {
            columns: [
                messages["reports.table.name"],
                messages["reports.history.bank"],
                messages["reports.table.currency"],
                messages["reports.average.account"]
            ],
            rows: [
                ...averageContributionReport.rows.map((row) => [row.name, row.bankName, row.currencyCode, formatChange(row.averageContribution)]),
                ...averageContributionReport.totals.map((total) => [
                    messages["reports.average.total"],
                    "",
                    total.currencyCode,
                    formatChange(total.averageContribution)
                ])
            ]
        }
    };
    renderAverageContributions(averageContributionReport.rows, averageContributionReport.totals);
    setAverageContributionsMessage(messages["reports.average.hint"] ?? "");
}

async function renderPlanningReportSection() {
    const planningReport = await fetchReportJson("/api/reports/planning");
    if (planningReport.rows.length === 0) {
        clearReportPdfData("planning");
        renderPlanningEmpty(messages["reports.planning.empty"]);
        setPlanningMessage(messages["reports.planning.hint"] ?? "");
        return;
    }

    reportPdfData.planning = {
        title: messages["reports.planning.title"],
        subtitle: messages["reports.planning.hint"] ?? "",
        table: {
            columns: [
                messages["reports.planning.account"],
                messages["reports.planning.current"],
                messages["reports.planning.currentPlan"],
                messages["reports.planning.currentDiff"],
                messages["reports.planning.monthly"],
                messages["reports.planning.yearTarget"],
                messages["reports.planning.planTarget"],
                messages["reports.planning.planDiff"]
            ],
            rows: [
                ...planningReport.rows.map((row) => [
                    `${row.name} (${row.bankName}, ${row.currencyCode})`,
                    row.currentBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.currentBalance),
                    row.currentPlannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.currentPlannedBalance),
                    row.currentDifferenceToPlan === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(row.currentDifferenceToPlan),
                    row.averageContribution === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(row.averageContribution),
                    row.projectedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.projectedBalance),
                    row.plannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(row.plannedBalance),
                    row.differenceToPlan === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(row.differenceToPlan)
                ]),
                ...planningReport.totals.map((total) => [
                    `${messages["reports.planning.total"]} [${total.currencyCode}]`,
                    total.currentBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.currentBalance),
                    total.currentPlannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.currentPlannedBalance),
                    total.currentDifferenceToPlan === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(total.currentDifferenceToPlan),
                    total.averageContribution === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(total.averageContribution),
                    total.projectedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.projectedBalance),
                    total.plannedBalance === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatAmount(total.plannedBalance),
                    total.differenceToPlan === null ? (messages["reports.planning.noData"] ?? "brak danych") : formatChange(total.differenceToPlan)
                ])
            ]
        }
    };
    renderPlanning(planningReport.rows, planningReport.totals);
    setPlanningMessage(messages["reports.planning.hint"] ?? "");
}

async function renderHistoryReportSection() {
    setHistoryMessage("");
    const range = resolveHistoryRange();
    const matrix = await fetchReportJson(
            `/api/reports/history?fromDate=${encodeURIComponent(range.fromDate)}&toDate=${encodeURIComponent(range.toDate)}&page=${currentHistoryPage}&size=${Number(historyPageSizeSelect.value)}`
    );
    if (matrix.accounts.length === 0) {
        clearReportPdfData("history");
        renderHistoryEmpty(messages["reports.history.empty"]);
        setHistoryMessage("");
        return;
    }

    renderHistoryTable(matrix);
    renderHistoryPagination(matrix);
    setHistoryMessage("");
    clearReportPdfData("history");
}

async function fetchHistoryPdfMatrix(range) {
    const pageSize = Math.min(HISTORY_PDF_EXPORT_PAGE_SIZE, MAX_REPORT_PDF_TABLE_ROWS);
    const firstPage = await fetchReportJson(
            `/api/reports/history?fromDate=${encodeURIComponent(range.fromDate)}&toDate=${encodeURIComponent(range.toDate)}&page=0&size=${pageSize}`
    );
    let exportRowCount = firstPage.rows.reduce((count, row) => count + row.values.filter((value) => value).length, 0);
    if (exportRowCount > MAX_REPORT_PDF_TABLE_ROWS) {
        throw new Error((messages["reports.error.pdfRowLimit"] ?? "")
                .replace("{rows}", String(MAX_REPORT_PDF_TABLE_ROWS)));
    }
    if ((firstPage.totalPages ?? 1) <= 1) {
        return firstPage;
    }

    const rows = [...firstPage.rows];
    for (let page = 1; page < firstPage.totalPages; page += 1) {
        const nextPage = await fetchReportJson(
                `/api/reports/history?fromDate=${encodeURIComponent(range.fromDate)}&toDate=${encodeURIComponent(range.toDate)}&page=${page}&size=${pageSize}`
        );
        rows.push(...nextPage.rows);
        exportRowCount += nextPage.rows.reduce((count, row) => count + row.values.filter((value) => value).length, 0);
        if (exportRowCount > MAX_REPORT_PDF_TABLE_ROWS) {
            throw new Error((messages["reports.error.pdfRowLimit"] ?? "")
                    .replace("{rows}", String(MAX_REPORT_PDF_TABLE_ROWS)));
        }
    }

    return {
        ...firstPage,
        rows,
        page: 0,
        pageSize: rows.length,
        first: true,
        last: true
    };
}

async function buildHistoryPdfExportData() {
    const matrix = await fetchHistoryPdfMatrix(resolveHistoryRange());
    const columns = [
        messages["reports.history.date"],
        messages["reports.history.account"],
        messages["reports.history.bank"],
        messages["reports.table.currency"],
        messages["reports.history.balance"],
        messages["reports.history.diff"]
    ];

    if (matrix.accounts.length === 0) {
        return {
            title: messages["reports.history.title"],
            table: {
                columns,
                rows: []
            }
        };
    }

    const rows = [];
    for (const row of matrix.rows) {
        for (let index = 0; index < row.values.length; index += 1) {
            const value = row.values[index];
            if (!value) {
                continue;
            }

            const account = matrix.accounts[index];
            rows.push([
                formatDate(row.date),
                account.accountName,
                account.bankName,
                account.currencyCode,
                formatAmount(value.balance),
                formatChange(value.diff)
            ]);

            if (rows.length > MAX_REPORT_PDF_TABLE_ROWS) {
                throw new Error((messages["reports.error.pdfRowLimit"] ?? "")
                        .replace("{rows}", String(MAX_REPORT_PDF_TABLE_ROWS)));
            }
        }
    }

    return {
        title: messages["reports.history.title"],
        table: {
            columns,
            rows
        }
    };
}

function renderReportSectionError(key, error) {
    clearReportPdfData(key);
    if (key === "summary") {
        renderEmpty(error.message);
        setMessage(error.message, "error");
    } else if (key === "overview") {
        renderOverviewEmpty(error.message);
        setOverviewMessage(error.message, "error");
    } else if (key === "averageContributions") {
        renderAverageContributionsEmpty(error.message);
        setAverageContributionsMessage(error.message, "error");
    } else if (key === "planning") {
        renderPlanningEmpty(error.message);
        setPlanningMessage(error.message, "error");
    } else if (key === "history") {
        renderHistoryEmpty(error.message);
        setHistoryMessage(error.message, "error");
    }
}

function showReportPdfError(key, error) {
    if (key === "summary") {
        setMessage(error.message, "error");
    } else if (key === "overview") {
        setOverviewMessage(error.message, "error");
    } else if (key === "averageContributions") {
        setAverageContributionsMessage(error.message, "error");
    } else if (key === "planning") {
        setPlanningMessage(error.message, "error");
    } else if (key === "history") {
        setHistoryMessage(error.message, "error");
    }
}

async function renderReportSection(key) {
    if (key === "summary") {
        await renderSummaryReportSection();
    } else if (key === "overview") {
        await renderOverviewReportSection();
    } else if (key === "averageContributions") {
        await renderAverageContributionsReportSection();
    } else if (key === "planning") {
        await renderPlanningReportSection();
    } else if (key === "history") {
        await renderHistoryReportSection();
    }
}

async function renderReportSectionIfVisible(key) {
    const section = reportSections[key];
    if (!section || !section.visible || !section.dirty || section.loading) {
        return;
    }

    section.loading = true;
    section.dirty = false;
    try {
        await renderReportSection(key);
    } catch (error) {
        renderReportSectionError(key, error);
    } finally {
        section.loading = false;
        updateReportsNavActiveState();
        scheduleReportsNavPanelStickyStateUpdate();
        if (section.visible && section.dirty) {
            void renderReportSectionIfVisible(key);
        }
    }
}

async function renderReportSectionForExport(key) {
    const section = reportSections[key];
    if (!section || section.loading || !section.dirty) {
        return;
    }

    section.loading = true;
    section.dirty = false;
    try {
        await renderReportSection(key);
    } catch (error) {
        section.dirty = true;
        throw error;
    } finally {
        section.loading = false;
        updateReportsNavActiveState();
        scheduleReportsNavPanelStickyStateUpdate();
        if (section.visible && section.dirty) {
            void renderReportSectionIfVisible(key);
        }
    }
}

function renderVisibleReportSections(keys = reportSectionKeys) {
    keys.forEach((key) => {
        void renderReportSectionIfVisible(key);
    });
}

function initializeReportLazyLoading() {
    if (!("IntersectionObserver" in window)) {
        reportSectionKeys.forEach((key) => {
            reportSections[key].visible = true;
        });
        renderVisibleReportSections();
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const key = reportSectionKeyForElement(entry.target);
            if (!key) {
                return;
            }

            reportSections[key].visible = entry.isIntersecting;
            if (entry.isIntersecting) {
                void renderReportSectionIfVisible(key);
            }
        });
    }, {threshold: 0.01});

    reportSectionKeys.forEach((key) => {
        const section = reportSections[key];
        if (section.element) {
            observer.observe(section.element);
        }
    });
}

async function refreshVisibleReports() {
    const visibleKeys = reportSectionKeys.filter((key) => reportSections[key]?.visible);
    markReportSectionsDirty(visibleKeys);
    renderVisibleReportSections(visibleKeys);
    await Promise.all(visibleKeys.map((key) => waitForSectionSettled(key)));
}

function waitForSectionIdle(key) {
    return new Promise((resolve) => {
        function check() {
            if (!reportSections[key]?.loading) {
                resolve();
                return;
            }
            window.setTimeout(check, 40);
        }
        check();
    });
}

function waitForSectionSettled(key) {
    return new Promise((resolve) => {
        function check() {
            const section = reportSections[key];
            if (!section || (!section.loading && !section.dirty)) {
                resolve();
                return;
            }
            window.setTimeout(check, 40);
        }
        check();
    });
}

function reportPdfFilename(title) {
    const slug = title.toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "raport";
    return `${slug}.pdf`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseFilenameFromDisposition(headerValue) {
    if (!headerValue) {
        return "";
    }

    const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) {
        try {
            return decodeURIComponent(utfMatch[1]);
        } catch {
            return utfMatch[1];
        }
    }

    const plainMatch = headerValue.match(/filename=\"?([^\";]+)\"?/i);
    return plainMatch ? plainMatch[1] : "";
}

async function requestReportPdf(key, data) {
    const response = await fetch(`/api/reports/pdf/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        let message = messages["reports.error.load"];
        try {
            const error = await response.json();
            if (error?.message) {
                message = error.message;
            }
        } catch {
        }
        throw new Error(message);
    }

    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().startsWith("application/pdf")) {
        throw new Error(messages["reports.error.load"]);
    }

    return {
        blob: await response.blob(),
        filename: parseFilenameFromDisposition(response.headers.get("Content-Disposition")) || reportPdfFilename(data.title || "raport")
    };
}

async function exportReportSectionToPdf(key, button) {
    const sectionState = reportSections[key];
    if (!sectionState?.element) {
        return;
    }

    button.disabled = true;
    try {
        await waitForSectionIdle(key);
        if (sectionState.dirty) {
            await renderReportSectionForExport(key);
        }
        await waitForSectionIdle(key);
        const data = key === "history"
                ? await buildHistoryPdfExportData()
                : reportPdfData[key];
        if (!data) {
            throw new Error(messages["reports.error.load"]);
        }
        if ((data.table?.rows?.length ?? 0) > MAX_REPORT_PDF_TABLE_ROWS) {
            throw new Error((messages["reports.error.pdfRowLimit"] ?? "")
                    .replace("{rows}", String(MAX_REPORT_PDF_TABLE_ROWS)));
        }
        const pdf = await requestReportPdf(key, data);
        downloadBlob(pdf.blob, pdf.filename);
    } catch (error) {
        showReportPdfError(key, error);
    } finally {
        button.disabled = false;
    }
}

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    document.title = `${messages["reports.heading.title"]} | ${messages["app.name"]}`;
    chartElement.setAttribute("aria-label", messages["reports.chart.aria.changes"]);
    overviewChartElement.setAttribute("aria-label", messages["reports.chart.aria.overview"]);
    reportScopeTabs.setAttribute("aria-label", messages["reports.controls.scope.report"]);
    overviewScopeTabs.setAttribute("aria-label", messages["reports.controls.scope.overview"]);
    historyPaginationElement.setAttribute("aria-label", messages["reports.history.pagination.aria"]);
    reportsNavElement.setAttribute("aria-label", messages["reports.nav.aria"]);
    reportFilterButtons.forEach((button) => MoneySnapshotUi.setTooltip(button, messages["reports.actions.filters"]));
    reportPdfButtons.forEach((button) => MoneySnapshotUi.setTooltip(button, messages["reports.actions.pdf"]));
    if (clearReportsCacheButton) {
        MoneySnapshotUi.setTooltip(clearReportsCacheButton, messages["reports.actions.clearCache"]);
    }
    if (!dateToInput.value) {
        dateToInput.value = todayIsoDate();
    }
    if (!dateFromInput.value) {
        dateFromInput.value = shiftDate(todayIsoDate(), periodOffsets["1m"]);
    }
    if (!historyDateToInput.value) {
        historyDateToInput.value = todayIsoDate();
    }
    if (!historyDateFromInput.value) {
        historyDateFromInput.value = shiftDate(todayIsoDate(), periodOffsets["1m"]);
    }
    markReportSectionsDirty();
    renderVisibleReportSections();
}

[periodSelect, dateFromInput, dateToInput].forEach((input) => {
    input.addEventListener("change", () => {
        updateCustomPeriodVisibility();
        markReportSectionsDirty(["summary"]);
        renderVisibleReportSections(["summary"]);
    });
});

scopeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        currentScope = tab.dataset.scope;
        scopeTabs.forEach((scopeTab) => {
            scopeTab.setAttribute("aria-selected", String(scopeTab === tab));
        });
        markReportSectionsDirty(["summary"]);
        renderVisibleReportSections(["summary"]);
    });
});

overviewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        currentOverviewScope = tab.dataset.scope;
        overviewTabs.forEach((overviewTab) => {
            overviewTab.setAttribute("aria-selected", String(overviewTab === tab));
        });
        markReportSectionsDirty(["overview"]);
        renderVisibleReportSections(["overview"]);
    });
});

refreshButton.addEventListener("click", () => {
    refreshVisibleReports().catch((error) => {
        reportSectionKeys.forEach((key) => {
            if (reportSections[key].visible) {
                renderReportSectionError(key, error);
            }
        });
    });
});

if (clearReportsCacheButton) {
    clearReportsCacheButton.addEventListener("click", async () => {
        clearReportsCacheButton.disabled = true;

        try {
            await clearReportsCache();
            currentHistoryPage = 0;
            clearReportPdfData();
            markReportSectionsDirty();
            await refreshVisibleReports();
            toastManager.show(messages["reports.cache.success"] ?? "", {type: "success"});
        } catch (error) {
            console.error(error);
            toastManager.show(error.message || messages["reports.error.clearCache"] || "", {type: "error"});
        } finally {
            clearReportsCacheButton.disabled = false;
        }
    });
}

refreshHistoryButton.addEventListener("click", () => {
    currentHistoryPage = 0;
    markReportSectionsDirty(["history"]);
    renderVisibleReportSections(["history"]);
});

historyPreviousPageButton.addEventListener("click", () => {
    if (currentHistoryPage === 0) {
        return;
    }

    currentHistoryPage -= 1;
    markReportSectionsDirty(["history"]);
    renderVisibleReportSections(["history"]);
});

historyNextPageButton.addEventListener("click", () => {
    currentHistoryPage += 1;
    markReportSectionsDirty(["history"]);
    renderVisibleReportSections(["history"]);
});

historyPageSizeSelect.addEventListener("change", () => {
    currentHistoryPage = 0;
    markReportSectionsDirty(["history"]);
    renderVisibleReportSections(["history"]);
});

reportPdfButtons.forEach((button) => {
    button.append(createPdfIcon());
    MoneySnapshotUi.setTooltip(button, button.textContent.trim());
    button.addEventListener("click", () => {
        void exportReportSectionToPdf(button.dataset.reportSection, button);
    });
});

reportFilterButtons.forEach((button) => {
    button.append(createFilterIcon());
    MoneySnapshotUi.setTooltip(button, button.textContent.trim());
    button.addEventListener("click", () => {
        toggleReportFilterMenu(button);
    });
});

if (clearReportsCacheButton) {
    clearReportsCacheButton.append(MoneySnapshotUi.createTrashIcon());
    MoneySnapshotUi.setTooltip(clearReportsCacheButton, clearReportsCacheButton.textContent.trim());
}

updateCustomPeriodVisibility();
updateHistoryCustomPeriodVisibility();
updateReportsNavActiveState();
updateReportsNavStickyOffset();
updateReportsNavPanelStickyState();

[historyPeriodSelect, historyDateFromInput, historyDateToInput].forEach((input) => {
    input.addEventListener("change", () => {
        currentHistoryPage = 0;
        updateHistoryCustomPeriodVisibility();
        markReportSectionsDirty(["history"]);
        renderVisibleReportSections(["history"]);
    });
});

window.addEventListener("scroll", updateReportsNavActiveState, {passive: true});
window.addEventListener("scroll", scheduleReportsNavPanelStickyStateUpdate, {passive: true});
window.addEventListener("resize", handleReportsNavResize);
reportsNavStickyMedia.addEventListener("change", handleReportsNavResize);
document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".report-filter-menu")) {
        closeReportFilterMenus();
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeReportFilterMenus(null, true);
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/reports/messages",
    onLanguageChange: ({language, messages}) => {
        handleLanguageChange(language, messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
            updateCustomPeriodVisibility();
            updateHistoryCustomPeriodVisibility();
            initializeReportLazyLoading();
        })
        .catch((error) => {
            reportSectionKeys.forEach((key) => renderReportSectionError(key, error));
        });
