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
const historyTableHeadRow = document.querySelector("#history-table-head-row");
const historyTableBody = document.querySelector("#history-table-body");
const reportsNavLinks = document.querySelectorAll(".reports-nav a[data-target]");
const reportsNavPanel = document.querySelector(".reports-nav-panel");

const periodOffsets = {
    "1m": {months: 1},
    "3m": {months: 3},
    "1y": {years: 1},
    "2y": {years: 2}
};

const historyPeriodOffsets = {
    "1m": {months: 1},
    "2m": {months: 2},
    "3m": {months: 3},
    "6m": {months: 6},
    "1y": {years: 1},
    "2y": {years: 2}
};

let currentLanguage = "pl";
let messages = {};
let cachedSnapshots = [];
let snapshotsLoaded = false;
let currentScope = "accounts";
let currentOverviewScope = "accounts";
let currentHistoryPage = 0;
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

function resolveDateRange() {
    if (periodSelect.value === "custom") {
        const fromDate = dateFromInput.value;
        const toDate = dateToInput.value;
        if (!fromDate || !toDate || fromDate > toDate) {
            throw new Error(messages["reports.error.customRange"]);
        }

        return {fromDate, toDate};
    }

    const toDate = todayIsoDate();
    return {
        fromDate: shiftDate(toDate, periodOffsets[periodSelect.value]),
        toDate
    };
}

function formatDate(value) {
    return MoneySnapshotUi.formatDateValue(value, userSettings);
}

function formatAmount(value) {
    return MoneySnapshotUi.formatMoneyValue(value, userSettings);
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

function updateReportsNavActiveState() {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const anchorY = Math.min(120, Math.max(72, viewportHeight * 0.18));
    let activeTarget = "";
    let nearestTarget = "";
    let nearestDistance = Number.POSITIVE_INFINITY;

    reportsNavLinks.forEach((link) => {
        const targetId = link.dataset.target ?? "";
        const section = document.getElementById(targetId);
        if (!section) {
            return;
        }

        const rect = section.getBoundingClientRect();
        const containsAnchor = rect.top <= anchorY && rect.bottom > anchorY;
        const distanceToAnchor = Math.abs(rect.top - anchorY);

        if (distanceToAnchor < nearestDistance) {
            nearestDistance = distanceToAnchor;
            nearestTarget = targetId;
        }

        if (containsAnchor) {
            activeTarget = targetId;
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

    const isDesktopSticky = window.matchMedia("(min-width: 861px)").matches
            && window.getComputedStyle(reportsNavPanel).position === "sticky";
    const rect = reportsNavPanel.getBoundingClientRect();
    reportsNavPanel.classList.toggle("is-stuck", isDesktopSticky && rect.top <= 0);
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
        const seriesDates = [...new Set([range.fromDate, ...pointDates, range.toDate])].sort();
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
    dateHead.textContent = messages["reports.history.date"];
    historyTableHeadRow.append(dateHead);
    matrix.accounts.forEach((account) => {
        const th = document.createElement("th");
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
            cell.innerHTML = `
                <span>${escapeHtml(formatAmount(value.balance))}</span>
                <span>${escapeHtml(formatChange(value.diff))}</span>
            `;
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
    dateHead.textContent = messages["reports.history.date"];
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
        const path = pieSlicePath(centerX, centerY, radius, angle, nextAngle);
        angle = nextAngle;
        return `<path d="${path}" data-overview-index="${index}" style="--chart-color: ${chartColor(index)}"></path>`;
    }).join("");

    const legend = rows.map((row, index) => `
        <li class="report-chart-legend-item" data-overview-index="${index}">
            <span class="report-chart-swatch" style="--chart-color: ${chartColor(index)}"></span>
            <span class="report-chart-legend-name">${escapeHtml(currentOverviewScope === "banks" ? row.name : `${row.name} (${row.currencyCode})`)}</span>
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

    const sliceElements = overviewChartElement.querySelectorAll(".overview-pie-chart path[data-overview-index]");
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
        if (!fromDate || !toDate || fromDate > toDate) {
            throw new Error(messages["reports.error.customRange"]);
        }

        return {fromDate, toDate};
    }

    const toDate = todayIsoDate();
    return {
        fromDate: shiftDate(toDate, historyPeriodOffsets[historyPeriodSelect.value]),
        toDate
    };
}

function enumerateDates(fromDate, toDate) {
    const dates = [];
    let date = fromDate;
    while (date <= toDate) {
        dates.push(date);
        date = addDays(date, 1);
    }
    return dates;
}

function buildHistoryRows(range) {
    const dates = enumerateDates(range.fromDate, range.toDate);
    const accountsMap = new Map();

    cachedSnapshots.forEach((snapshot) => {
        const account = accountsMap.get(snapshot.accountId) ?? {
            id: snapshot.accountId,
            accountName: snapshot.accountName,
            bankName: snapshot.bankName,
            currencyCode: snapshot.currencyCode,
            snapshots: []
        };
        account.snapshots.push(snapshot);
        accountsMap.set(snapshot.accountId, account);
    });

    const accounts = [...accountsMap.values()]
            .sort((left, right) => left.accountName.localeCompare(right.accountName, locale()) || left.currencyCode.localeCompare(right.currencyCode));

    const seriesByAccountId = new Map();
    accounts.forEach((account) => {
        const snapshots = [...account.snapshots].sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate));
        let snapshotIndex = 0;
        let currentBalance = 0;

        while (snapshotIndex < snapshots.length && snapshots[snapshotIndex].snapshotDate <= range.fromDate) {
            currentBalance = Number(snapshots[snapshotIndex].balance);
            snapshotIndex += 1;
        }

        let previousBalance = currentBalance;
        const series = new Map();
        dates.forEach((date) => {
            while (snapshotIndex < snapshots.length && snapshots[snapshotIndex].snapshotDate <= date) {
                currentBalance = Number(snapshots[snapshotIndex].balance);
                snapshotIndex += 1;
            }

            series.set(date, {
                balance: currentBalance,
                diff: currentBalance - previousBalance
            });
            previousBalance = currentBalance;
        });
        seriesByAccountId.set(account.id, series);
    });

    const rows = [...dates].reverse().map((date) => ({
        date,
        values: accounts.map((account) => seriesByAccountId.get(account.id).get(date))
    }));

    return {accounts, rows};
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
    const matrix = buildHistoryRows(range);
    if (matrix.accounts.length === 0) {
        renderHistoryEmpty(messages["reports.history.empty"]);
        setHistoryMessage(`${formatDate(range.fromDate)} - ${formatDate(range.toDate)}`);
        return;
    }

    const pagedMatrix = paginateHistoryMatrix(matrix);
    renderHistoryTable(pagedMatrix);
    renderHistoryPagination(pagedMatrix);
    setHistoryMessage(`${formatDate(range.fromDate)} - ${formatDate(range.toDate)}`);
}

function updateCustomPeriodVisibility() {
    const isCustom = periodSelect.value === "custom";
    customPeriodFields.forEach((field) => {
        field.hidden = !isCustom;
    });
}

function updateHistoryCustomPeriodVisibility() {
    const isCustom = historyPeriodSelect.value === "custom";
    historyCustomPeriodFields.forEach((field) => {
        field.hidden = !isCustom;
    });
}

function renderReports() {
    if (!snapshotsLoaded) {
        return;
    }

    try {
        setMessage("");
        const range = resolveDateRange();
        const {rows, step, checkpoints} = buildRows(cachedSnapshots, range, currentScope);
        if (rows.length === 0) {
            renderEmpty(messages["reports.empty"]);
            renderOverviewEmpty(messages["reports.overview.empty"]);
            renderHistoryEmpty(messages["reports.history.empty"]);
            setHistoryMessage("");
            return;
        }

        setMessage(`${formatDate(range.fromDate)} - ${formatDate(range.toDate)}`);
        renderChart(rows, step, checkpoints);
        renderTable(rows);
        renderOverview(range.toDate);
        renderHistory();
    } catch (error) {
        renderEmpty(error.message);
        renderOverviewEmpty(error.message);
        renderHistoryEmpty(error.message);
        setMessage(error.message, "error");
        setHistoryMessage(error.message, "error");
    }
}

async function loadReports() {
    const response = await fetch("/api/snapshots");
    if (!response.ok) {
        throw new Error(messages["reports.error.load"]);
    }

    cachedSnapshots = await response.json();
    snapshotsLoaded = true;
    renderReports();
}

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    document.title = `${messages["reports.heading.title"]} | ${messages["app.name"]}`;
    chartElement.setAttribute("aria-label", messages["reports.chart.aria.changes"]);
    overviewChartElement.setAttribute("aria-label", messages["reports.chart.aria.overview"]);
    reportScopeTabs.setAttribute("aria-label", messages["reports.controls.scope.report"]);
    overviewScopeTabs.setAttribute("aria-label", messages["reports.controls.scope.overview"]);
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
        historyDateFromInput.value = shiftDate(todayIsoDate(), historyPeriodOffsets["1m"]);
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
        setMessage(error.message, "error");
    });
});

refreshHistoryButton.addEventListener("click", () => {
    currentHistoryPage = 0;
    renderReports();
});

historyPreviousPageButton.addEventListener("click", () => {
    if (currentHistoryPage === 0) {
        return;
    }

    currentHistoryPage -= 1;
    renderReports();
});

historyNextPageButton.addEventListener("click", () => {
    currentHistoryPage += 1;
    renderReports();
});

historyPageSizeSelect.addEventListener("change", () => {
    currentHistoryPage = 0;
    renderReports();
});

updateCustomPeriodVisibility();
updateHistoryCustomPeriodVisibility();
updateReportsNavActiveState();
updateReportsNavPanelStickyState();

[historyPeriodSelect, historyDateFromInput, historyDateToInput].forEach((input) => {
    input.addEventListener("change", () => {
        currentHistoryPage = 0;
        updateHistoryCustomPeriodVisibility();
        renderReports();
    });
});

window.addEventListener("scroll", updateReportsNavActiveState, {passive: true});
window.addEventListener("scroll", updateReportsNavPanelStickyState, {passive: true});
window.addEventListener("resize", updateReportsNavActiveState);
window.addEventListener("resize", updateReportsNavPanelStickyState);

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
            renderHistoryEmpty(error.message);
            setHistoryMessage(error.message, "error");
        });
