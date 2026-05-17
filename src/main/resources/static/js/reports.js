const scopeTabs = document.querySelectorAll(".report-tab");
const periodSelect = document.querySelector("#report-period");
const dateFromInput = document.querySelector("#report-date-from");
const dateToInput = document.querySelector("#report-date-to");
const customPeriodFields = document.querySelectorAll(".custom-period-field");
const refreshButton = document.querySelector("#refresh-reports");
const messageElement = document.querySelector("#reports-message");
const chartElement = document.querySelector("#reports-chart");
const tableBody = document.querySelector("#reports-table-body");

const periodOffsets = {
    "1m": {months: 1},
    "3m": {months: 3},
    "1y": {years: 1},
    "2y": {years: 2}
};

let currentLanguage = "pl";
let messages = {};
let cachedSnapshots = [];
let snapshotsLoaded = false;
let currentScope = "accounts";
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

function chartStep() {
    if (periodSelect.value === "1m") {
        return "day";
    }

    if (periodSelect.value === "3m") {
        return "week";
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

function buildCheckpoints({fromDate, toDate}) {
    const step = chartStep();
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
    const checkpoints = buildCheckpoints(range);

    return buildEntries(snapshots, scope).map((entry) => {
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
        const seriesDates = [...new Set([...checkpoints, ...pointDates])].sort();
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

function linePath(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function chartDateLabel(date) {
    const options = chartStep() === "month"
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

function renderChart(rows) {
    if (rows.length === 0) {
        chartElement.innerHTML = `<div class="chart-empty">${escapeHtml(messages["reports.chart.empty"])}</div>`;
        return;
    }

    const checkpoints = rows[0].series.map((point) => point.date);
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
        <text class="report-chart-axis-label" x="${xForDate(date)}" y="${height - 8}" text-anchor="middle">${escapeHtml(chartDateLabel(date))}</text>
    `).join("");

    const lines = rows.map((row, index) => {
        const color = chartColor(index);
        const points = row.series.map((point) => ({
            ...point,
            x: xForDate(point.date),
            y: yForChange(point.change)
        }));
        const snapshotPoints = row.points.map((point) => ({
            ...point,
            x: xForDate(point.date),
            y: yForChange(point.change)
        }));
        return `
            <path class="report-chart-line" d="${linePath(points)}" style="--chart-color: ${color}"></path>
            ${snapshotPoints.map((point) => `<circle class="report-chart-point" cx="${point.x}" cy="${point.y}" r="2" style="--chart-color: ${color}"></circle>`).join("")}
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
            <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Balance changes over time chart">
                <line class="report-chart-zero" x1="${leftPadding}" x2="${width - rightPadding}" y1="${zeroY}" y2="${zeroY}"></line>
                <text class="report-chart-axis-label" x="${leftPadding - 7}" y="${zeroY + 3}" text-anchor="end">0</text>
                ${axisLabels}
                ${lines}
            </svg>
        </div>
    `;
}

function updateCustomPeriodVisibility() {
    const isCustom = periodSelect.value === "custom";
    customPeriodFields.forEach((field) => {
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
        const rows = buildRows(cachedSnapshots, range, currentScope);
        if (rows.length === 0) {
            renderEmpty(messages["reports.empty"]);
            return;
        }

        setMessage(`${formatDate(range.fromDate)} - ${formatDate(range.toDate)}`);
        renderChart(rows);
        renderTable(rows);
    } catch (error) {
        renderEmpty(error.message);
        setMessage(error.message, "error");
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
    if (!dateToInput.value) {
        dateToInput.value = todayIsoDate();
    }
    if (!dateFromInput.value) {
        dateFromInput.value = shiftDate(todayIsoDate(), periodOffsets["1m"]);
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

refreshButton.addEventListener("click", () => {
    loadReports().catch((error) => {
        renderEmpty(error.message);
        setMessage(error.message, "error");
    });
});

updateCustomPeriodVisibility();

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
        });
