const scopeTabs = document.querySelectorAll(".report-scope-tab");
const overviewTabs = document.querySelectorAll(".overview-tab");
const periodSelect = document.querySelector("#report-period");
const dateFromInput = document.querySelector("#report-date-from");
const dateToInput = document.querySelector("#report-date-to");
const customPeriodFields = document.querySelectorAll(".custom-period-field");
const refreshButton = document.querySelector("#refresh-reports");
const messageElement = document.querySelector("#reports-message");
const chartElement = document.querySelector("#reports-chart");
const tableBody = document.querySelector("#reports-table-body");
const overviewChartElement = document.querySelector("#overview-chart");
const overviewTableBody = document.querySelector("#overview-table-body");
const averageContributionsMessageElement = document.querySelector("#average-contributions-message");
const averageContributionsTableBody = document.querySelector("#average-contributions-table-body");
const averageContributionsTableFoot = document.querySelector("#average-contributions-table-foot");
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
const reportsNavStickyMedia = window.matchMedia("(min-width: 861px)");

const periodOffsets = {
    "1m": {months: 1},
    "2m": {months: 2},
    "3m": {months: 3},
    "6m": {months: 6},
    "1y": {years: 1},
    "2y": {years: 2}
};
const MAX_HISTORY_RANGE_DAYS = 732;

let currentLanguage = "pl";
let messages = {};
let cachedSnapshots = [];
let snapshotsLoaded = false;
let currentScope = "accounts";
let currentOverviewScope = "accounts";
let currentHistoryPage = 0;
let historyMatrixCache = null;
let historyMatrixCacheKey = "";
let averageContributionReportCache = null;
let averageContributionReportCacheKey = "";
let snapshotsVersion = 0;
let reportsNavStickyEnabled = reportsNavStickyMedia.matches;
let reportsNavStickyFramePending = false;
let userSettings = null;

function locale() {
    return currentLanguage === "en" ? "en-US" : "pl-PL";
}

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
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

function periodStartDateForBillingCycle(today, billingMonthStartDay) {
    const normalizedStartDay = Math.max(1, Math.min(31, billingMonthStartDay));
    const currentDate = new Date(`${today}T00:00:00Z`);
    const currentMonthStart = new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth(),
            Math.min(normalizedStartDay, new Date(Date.UTC(
                    currentDate.getUTCFullYear(),
                    currentDate.getUTCMonth() + 1,
                    0
            )).getUTCDate())
    ));

    if (today >= currentMonthStart.toISOString().slice(0, 10)) {
        return currentMonthStart.toISOString().slice(0, 10);
    }

    const previousMonthDate = new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth() - 1,
            1
    ));
    previousMonthDate.setUTCDate(Math.min(normalizedStartDay, new Date(Date.UTC(
            previousMonthDate.getUTCFullYear(),
            previousMonthDate.getUTCMonth() + 1,
            0
    )).getUTCDate()));
    return previousMonthDate.toISOString().slice(0, 10);
}

function billingRange() {
    const today = todayIsoDate();
    const billingMonthStartDay = Math.max(1, Math.min(userSettings?.billingMonthStartDay ?? 1, 31));
    const periodStartDate = periodStartDateForBillingCycle(today, billingMonthStartDay);
    return {
        fromDate: addDays(periodStartDate, -1),
        toDate: addDays(addMonths(periodStartDate, 1), -1)
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
    const displayFromDate = periodValue === "billing" ? addDays(range.fromDate, 1) : range.fromDate;
    return `${formatDate(displayFromDate)} - ${formatDate(range.toDate)}`;
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

function escapeHtml(value) {
    return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll("\"", "&quot;")
            .replaceAll("'", "&#39;");
}

function setMessage(text, type = "") {
    messageElement.textContent = text;
    messageElement.dataset.type = type;
}

function setHistoryMessage(text, type = "") {
    historyMessageElement.textContent = text;
    historyMessageElement.dataset.type = type;
}

function setAverageContributionsMessage(text, type = "") {
    averageContributionsMessageElement.textContent = text;
    averageContributionsMessageElement.dataset.type = type;
}

function invalidateHistoryCache() {
    historyMatrixCache = null;
    historyMatrixCacheKey = "";
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

    const rect = reportsNavPanel.getBoundingClientRect();
    reportsNavPanel.classList.toggle("is-stuck", reportsNavStickyEnabled && rect.top <= 0);
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
    updateReportsNavActiveState();
    scheduleReportsNavPanelStickyStateUpdate();
}

function latestBalanceAtOrBefore(snapshots, date) {
    const candidate = snapshots
            .filter((snapshot) => snapshot.snapshotDate <= date)
            .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))[0];
    return candidate ? Number(candidate.balance) : 0;
}

function groupKey(snapshot, scope) {
    if (scope === "accounts") {
        return `${snapshot.accountId}|${snapshot.currencyCode}`;
    }

    if (scope === "banks") {
        return `${snapshot.bankName}|${snapshot.currencyCode}`;
    }

    return `total|${snapshot.currencyCode}`;
}

function groupName(snapshot, scope) {
    if (scope === "accounts") {
        return snapshot.accountName;
    }

    if (scope === "banks") {
        return snapshot.bankName;
    }

    return messages["reports.total.name"];
}

function buildEntries(snapshots, scope) {
    const groupedSnapshots = new Map();

    snapshots.forEach((snapshot) => {
        const key = groupKey(snapshot, scope);
        const entry = groupedSnapshots.get(key) ?? {
            name: groupName(snapshot, scope),
            currencyCode: snapshot.currencyCode,
            accountSnapshots: scope === "accounts" ? null : new Map(),
            snapshots: []
        };

        if (scope === "accounts") {
            entry.snapshots.push(snapshot);
        } else {
            const accountSnapshots = entry.accountSnapshots.get(snapshot.accountId) ?? [];
            accountSnapshots.push(snapshot);
            entry.accountSnapshots.set(snapshot.accountId, accountSnapshots);
        }

        groupedSnapshots.set(key, entry);
    });

    return [...groupedSnapshots.values()];
}

function balanceForEntryAt(entry, date) {
    if (entry.accountSnapshots) {
        return [...entry.accountSnapshots.values()]
                .reduce((sum, accountSnapshots) => sum + latestBalanceAtOrBefore(accountSnapshots, date), 0);
    }

    return latestBalanceAtOrBefore(entry.snapshots, date);
}

function resolveChartStep(range) {
    if (periodSelect.value === "1m") {
        return "day";
    }

    if (periodSelect.value === "billing") {
        return "day";
    }

    if (periodSelect.value === "3m") {
        return "week";
    }

    if (periodSelect.value === "custom") {
        const from = new Date(`${range.fromDate}T00:00:00Z`).getTime();
        const to = new Date(`${range.toDate}T00:00:00Z`).getTime();
        const days = Math.floor((to - from) / 86400000) + 1;

        if (days <= 31) {
            return "day";
        }

        if (days <= 92) {
            return "week";
        }
    }

    return "month";
}

function nextCheckpoint(date, step) {
    if (step === "day") {
        return addDays(date, 1);
    }

    if (step === "week") {
        return addDays(date, 7);
    }

    return addMonths(date, 1);
}

function buildCheckpoints({fromDate, toDate}, step) {
    const checkpoints = [fromDate];
    let nextDate = nextCheckpoint(fromDate, step);

    while (nextDate < toDate) {
        checkpoints.push(nextDate);
        nextDate = nextCheckpoint(nextDate, step);
    }

    if (checkpoints.at(-1) !== toDate) {
        checkpoints.push(toDate);
    }

    return checkpoints;
}

function buildRows(snapshots, range, scope) {
    const step = resolveChartStep(range);
    const checkpoints = buildCheckpoints(range, step);

    const rows = buildEntries(snapshots, scope).map((entry) => {
        const startBalance = balanceForEntryAt(entry, range.fromDate);
        const endBalance = balanceForEntryAt(entry, range.toDate);
        const change = endBalance - startBalance;
        const snapshotsForPoints = entry.accountSnapshots
                ? [...entry.accountSnapshots.values()].flat()
                : entry.snapshots;
        const pointDates = [...new Set(snapshotsForPoints
                .filter((snapshot) => snapshot.snapshotDate >= range.fromDate && snapshot.snapshotDate <= range.toDate)
                .map((snapshot) => snapshot.snapshotDate))]
                .sort();
        const points = pointDates.map((date) => {
            const balance = balanceForEntryAt(entry, date);
            return {
                date,
                balance,
                change: balance - startBalance
            };
        });
        const seriesDates = [...new Set([range.fromDate, ...checkpoints, ...pointDates, range.toDate])].sort();
        const series = seriesDates.map((date) => {
            const balance = balanceForEntryAt(entry, date);
            return {
                date,
                balance,
                change: balance - startBalance
            };
        });

        return {
            name: entry.name,
            currencyCode: entry.currencyCode,
            startBalance,
            endBalance,
            change,
            changePercent: startBalance === 0 ? null : (change * 100) / startBalance,
            points,
            series
        };
    }).sort((left, right) => left.name.localeCompare(right.name, locale()) || left.currencyCode.localeCompare(right.currencyCode));

    return {rows, step, checkpoints};
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

    const startTime = new Date(`${checkpoints[0]}T00:00:00Z`).getTime();
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

function buildOverviewRows(snapshots, toDate, scope) {
    return buildEntries(snapshots, scope)
            .map((entry) => {
                const balance = balanceForEntryAt(entry, toDate);
                return {
                    name: entry.name,
                    currencyCode: entry.currencyCode,
                    balance
                };
            })
            .filter((row) => row.balance !== 0)
            .sort((left, right) => right.balance - left.balance);
}

function buildAverageContributionRows(snapshots) {
    const grouped = new Map();
    snapshots.forEach((snapshot) => {
        if (snapshot.snapshotType !== "FINAL") {
            return;
        }

        const key = `${snapshot.accountId}|${snapshot.currencyCode}`;
        const entry = grouped.get(key) ?? {
            accountName: snapshot.accountName,
            bankName: snapshot.bankName,
            currencyCode: snapshot.currencyCode,
            finalSnapshots: []
        };

        entry.finalSnapshots.push({
            snapshotDate: snapshot.snapshotDate,
            balance: Number(snapshot.balance)
        });

        grouped.set(key, entry);
    });

    const rows = [...grouped.values()]
            .filter((entry) => entry.finalSnapshots.length >= 2)
            .map((entry) => {
                const balances = [...entry.finalSnapshots]
                        .sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate))
                        .slice(-3);

                const changes = [];
                for (let index = 1; index < balances.length; index += 1) {
                    changes.push(balances[index].balance - balances[index - 1].balance);
                }

                return {
                    name: entry.accountName,
                    bankName: entry.bankName,
                    currencyCode: entry.currencyCode,
                    averageContribution: changes.reduce((sum, value) => sum + value, 0) / changes.length,
                    sampleFromDate: balances[0]?.snapshotDate ?? null,
                    sampleToDate: balances.at(-1)?.snapshotDate ?? null
                };
            })
            .sort((left, right) => left.name.localeCompare(right.name, locale()) || left.currencyCode.localeCompare(right.currencyCode, locale()));

    const totals = [...rows.reduce((accumulator, row) => {
        accumulator.set(
                row.currencyCode,
                (accumulator.get(row.currencyCode) ?? 0) + row.averageContribution
        );
        return accumulator;
    }, new Map()).entries()]
            .map(([currencyCode, averageContribution]) => ({currencyCode, averageContribution}))
            .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode, locale()));

    return {rows, totals};
}

function invalidateAverageContributionReportCache() {
    averageContributionReportCache = null;
    averageContributionReportCacheKey = "";
}

function getAverageContributionReport(snapshots) {
    const cacheKey = `${snapshotsVersion}|${locale()}`;
    if (averageContributionReportCache && averageContributionReportCacheKey === cacheKey) {
        return averageContributionReportCache;
    }

    averageContributionReportCache = buildAverageContributionRows(snapshots);
    averageContributionReportCacheKey = cacheKey;
    return averageContributionReportCache;
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

function renderOverview(toDate) {
    const rawRows = buildOverviewRows(cachedSnapshots, toDate, currentOverviewScope);
    if (rawRows.length === 0) {
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

function buildHistoryRows(range) {
    validateHistoryRange(range.fromDate, range.toDate);
    const snapshotsByAccountId = new Map();
    cachedSnapshots.forEach((snapshot) => {
        const accountSnapshots = snapshotsByAccountId.get(snapshot.accountId) ?? [];
        accountSnapshots.push(snapshot);
        snapshotsByAccountId.set(snapshot.accountId, accountSnapshots);
    });

    const snapshotsInRange = cachedSnapshots.filter((snapshot) =>
        snapshot.snapshotDate >= range.fromDate && snapshot.snapshotDate <= range.toDate
    );
    if (snapshotsInRange.length === 0) {
        return {accounts: [], rows: []};
    }

    const accountsMap = new Map();
    const dates = [...new Set(snapshotsInRange.map((snapshot) => snapshot.snapshotDate))]
            .sort((left, right) => right.localeCompare(left));

    snapshotsInRange.forEach((snapshot) => {
        const account = accountsMap.get(snapshot.accountId) ?? {
            id: snapshot.accountId,
            accountName: snapshot.accountName,
            bankName: snapshot.bankName,
            currencyCode: snapshot.currencyCode
        };
        accountsMap.set(snapshot.accountId, account);
    });

    const accounts = [...accountsMap.values()]
            .sort((left, right) => left.accountName.localeCompare(right.accountName, locale()) || left.currencyCode.localeCompare(right.currencyCode));

    const seriesByAccountId = new Map();
    accounts.forEach((account) => {
        const snapshots = [...(snapshotsByAccountId.get(account.id) ?? [])]
                .sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate));
        const series = new Map();
        let previousBalance = null;
        snapshots.forEach((snapshot) => {
            const balance = Number(snapshot.balance);
            const isInRange = snapshot.snapshotDate >= range.fromDate && snapshot.snapshotDate <= range.toDate;
            if (isInRange) {
                series.set(snapshot.snapshotDate, {
                    balance,
                    diff: previousBalance === null ? balance : balance - previousBalance
                });
            }
            previousBalance = balance;
        });
        seriesByAccountId.set(account.id, series);
    });

    const rows = dates.map((date) => ({
        date,
        values: accounts.map((account) => seriesByAccountId.get(account.id).get(date) ?? null)
    }));

    return {accounts, rows};
}

function historyRangeCacheKey(range) {
    return `${range.fromDate}:${range.toDate}:${currentLanguage}`;
}

function historyMatrixForRange(range) {
    const cacheKey = historyRangeCacheKey(range);
    if (historyMatrixCache && historyMatrixCacheKey === cacheKey) {
        return historyMatrixCache;
    }

    historyMatrixCache = buildHistoryRows(range);
    historyMatrixCacheKey = cacheKey;
    return historyMatrixCache;
}

function paginateHistoryMatrix(matrix) {
    const pageSize = Number(historyPageSizeSelect.value);
    const totalElements = matrix.rows.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
    if (currentHistoryPage >= totalPages) {
        currentHistoryPage = totalPages - 1;
    }

    const startIndex = currentHistoryPage * pageSize;
    const endIndex = startIndex + pageSize;
    return {
        accounts: matrix.accounts,
        rows: matrix.rows.slice(startIndex, endIndex),
        page: currentHistoryPage,
        pageSize,
        totalElements,
        totalPages,
        first: currentHistoryPage === 0,
        last: currentHistoryPage >= totalPages - 1
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

function renderHistory() {
    const range = resolveHistoryRange();
    const matrix = historyMatrixForRange(range);
    if (matrix.accounts.length === 0) {
        renderHistoryEmpty(messages["reports.history.empty"]);
        setHistoryMessage("");
        return;
    }

    const pagedMatrix = paginateHistoryMatrix(matrix);
    renderHistoryTable(pagedMatrix);
    renderHistoryPagination(pagedMatrix);
    setHistoryMessage("");
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

function renderHistorySection() {
    if (!snapshotsLoaded) {
        return;
    }

    try {
        setHistoryMessage("");
        renderHistory();
    } catch (error) {
        renderHistoryEmpty(error.message);
        setHistoryMessage(error.message, "error");
    } finally {
        updateReportsNavActiveState();
        scheduleReportsNavPanelStickyStateUpdate();
    }
}

function renderReports() {
    if (!snapshotsLoaded) {
        return;
    }

    try {
        setMessage("");
        const range = resolveDateRange();
        const averageContributionReport = getAverageContributionReport(cachedSnapshots);
        const {rows, step, checkpoints} = buildRows(cachedSnapshots, range, currentScope);
        if (averageContributionReport.rows.length === 0) {
            renderAverageContributionsEmpty(messages["reports.average.empty"]);
            setAverageContributionsMessage(messages["reports.average.hint"] ?? "");
        } else {
            renderAverageContributions(averageContributionReport.rows, averageContributionReport.totals);
            setAverageContributionsMessage(messages["reports.average.hint"] ?? "");
        }

        if (rows.length === 0) {
            renderEmpty(messages["reports.empty"]);
            renderOverviewEmpty(messages["reports.overview.empty"]);
            renderHistoryEmpty(messages["reports.history.empty"]);
            setHistoryMessage("");
            return;
        }

        setMessage(displayRangeLabel(range, periodSelect.value));
        renderChart(rows, step, checkpoints);
        renderTable(rows);
        renderOverview(todayIsoDate());
        renderHistorySection();
    } catch (error) {
        renderEmpty(error.message);
        renderOverviewEmpty(error.message);
        renderAverageContributionsEmpty(error.message);
        renderHistoryEmpty(error.message);
        setMessage(error.message, "error");
        setAverageContributionsMessage(error.message, "error");
        setHistoryMessage(error.message, "error");
    } finally {
        updateReportsNavActiveState();
        scheduleReportsNavPanelStickyStateUpdate();
    }
}

async function loadReports() {
    const response = await fetch("/api/snapshots");
    if (!response.ok) {
        throw new Error(messages["reports.error.load"]);
    }

    cachedSnapshots = await response.json();
    snapshotsLoaded = true;
    snapshotsVersion += 1;
    invalidateAverageContributionReportCache();
    invalidateHistoryCache();
    renderReports();
}

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    invalidateAverageContributionReportCache();
    invalidateHistoryCache();
    document.title = `${messages["reports.heading.title"]} | ${messages["app.name"]}`;
    chartElement.setAttribute("aria-label", messages["reports.chart.aria.changes"]);
    overviewChartElement.setAttribute("aria-label", messages["reports.chart.aria.overview"]);
    reportScopeTabs.setAttribute("aria-label", messages["reports.controls.scope.report"]);
    overviewScopeTabs.setAttribute("aria-label", messages["reports.controls.scope.overview"]);
    historyPaginationElement.setAttribute("aria-label", messages["reports.history.pagination.aria"]);
    reportsNavElement.setAttribute("aria-label", messages["reports.nav.aria"]);
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
    renderReports();
}

[periodSelect, dateFromInput, dateToInput].forEach((input) => {
    input.addEventListener("change", () => {
        updateCustomPeriodVisibility();
        renderReports();
    });
});

scopeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        currentScope = tab.dataset.scope;
        scopeTabs.forEach((scopeTab) => {
            scopeTab.setAttribute("aria-selected", String(scopeTab === tab));
        });
        renderReports();
    });
});

overviewTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        currentOverviewScope = tab.dataset.scope;
        overviewTabs.forEach((overviewTab) => {
            overviewTab.setAttribute("aria-selected", String(overviewTab === tab));
        });
        renderReports();
    });
});

refreshButton.addEventListener("click", () => {
    loadReports().catch((error) => {
        renderEmpty(error.message);
        renderOverviewEmpty(error.message);
        renderAverageContributionsEmpty(error.message);
        setMessage(error.message, "error");
        setAverageContributionsMessage(error.message, "error");
    });
});

refreshHistoryButton.addEventListener("click", () => {
    currentHistoryPage = 0;
    renderHistorySection();
});

historyPreviousPageButton.addEventListener("click", () => {
    if (currentHistoryPage === 0) {
        return;
    }

    currentHistoryPage -= 1;
    renderHistorySection();
});

historyNextPageButton.addEventListener("click", () => {
    currentHistoryPage += 1;
    renderHistorySection();
});

historyPageSizeSelect.addEventListener("change", () => {
    currentHistoryPage = 0;
    renderHistorySection();
});

updateCustomPeriodVisibility();
updateHistoryCustomPeriodVisibility();
updateReportsNavActiveState();
updateReportsNavPanelStickyState();

[historyPeriodSelect, historyDateFromInput, historyDateToInput].forEach((input) => {
    input.addEventListener("change", () => {
        currentHistoryPage = 0;
        updateHistoryCustomPeriodVisibility();
        renderHistorySection();
    });
});

window.addEventListener("scroll", updateReportsNavActiveState, {passive: true});
window.addEventListener("scroll", scheduleReportsNavPanelStickyStateUpdate, {passive: true});
window.addEventListener("resize", handleReportsNavResize);
reportsNavStickyMedia.addEventListener("change", handleReportsNavResize);

MoneySnapshotI18n.init({
    endpoint: "/api/reports/messages",
    onLanguageChange: ({language, messages}) => {
        handleLanguageChange(language, messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadReports)
        .catch((error) => {
        renderEmpty(error.message);
        renderOverviewEmpty(error.message);
        renderAverageContributionsEmpty(error.message);
        renderHistoryEmpty(error.message);
        setMessage(error.message, "error");
        setAverageContributionsMessage(error.message, "error");
        setHistoryMessage(error.message, "error");
    });
