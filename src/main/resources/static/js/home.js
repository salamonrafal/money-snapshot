const periodElement = document.querySelector("#snapshot-panel-period");
const changePercentElement = document.querySelector("#snapshot-panel-change-percent");
const accountsElement = document.querySelector("#snapshot-panel-accounts");
const balanceElement = document.querySelector("#snapshot-panel-balance");
const changeElement = document.querySelector("#snapshot-panel-change");
const chartElement = document.querySelector("#snapshot-panel-chart");

let currentLanguage = "pl";
let userSettings = null;

function formatCurrencyAmount({currencyCode, amount}, includeSign = false) {
    const numericAmount = Number(amount);
    const sign = includeSign && numericAmount > 0 ? "+" : "";
    return `${sign}${MoneySnapshotUi.formatMoneyValue(numericAmount, userSettings)}`;
}

function formatAmountList(amounts, includeSign = false) {
    if (!amounts || amounts.length === 0) {
        return "-";
    }

    return amounts.map((amount) => formatCurrencyAmount(amount, includeSign)).join("\n");
}

function formatPeriod(periodDate) {
    if (!periodDate) {
        return "-";
    }

    if ((userSettings?.billingMonthStartDay ?? 1) !== 1) {
        const endDate = new Date(periodEndDate(periodDate).getTime() - 86400000).toISOString().slice(0, 10);
        return `${MoneySnapshotUi.formatDateValue(periodDate, userSettings)} - ${MoneySnapshotUi.formatDateValue(endDate, userSettings)}`;
    }

    const period = new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "pl-PL", {
        month: "long",
        year: "numeric"
    }).format(new Date(`${periodDate}T00:00:00Z`));
    return period.charAt(0).toUpperCase() + period.slice(1);
}

function formatPercent(value) {
    if (value === null || value === undefined) {
        return "-";
    }

    const numericValue = Number(value);
    const sign = numericValue > 0 ? "+" : "";
    return `${sign}${numericValue.toFixed(1)}%`;
}

function renderSnapshotPanel(panel) {
    periodElement.textContent = formatPeriod(panel.periodDate);
    changePercentElement.textContent = formatPercent(panel.monthlyChangePercent);
    accountsElement.textContent = panel.trackedAccounts;
    balanceElement.textContent = formatAmountList(panel.currentBalances);
    changeElement.textContent = formatAmountList(panel.monthlyChanges, true);
}

function monthEndDate(periodDate) {
    const startDate = new Date(`${periodDate}T00:00:00Z`);
    const billingMonthStartDay = Math.min(Math.max(userSettings?.billingMonthStartDay ?? 1, 1), 31);
    const nextMonthDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
    const lastDayOfNextMonth = new Date(Date.UTC(
            nextMonthDate.getUTCFullYear(),
            nextMonthDate.getUTCMonth() + 1,
            0
    )).getUTCDate();
    nextMonthDate.setUTCDate(Math.min(billingMonthStartDay, lastDayOfNextMonth));
    return nextMonthDate;
}

function periodEndDate(periodDate) {
    return monthEndDate(periodDate);
}

function shiftIsoDate(date, days) {
    const shiftedDate = new Date(`${date}T00:00:00Z`);
    shiftedDate.setUTCDate(shiftedDate.getUTCDate() + days);
    return shiftedDate.toISOString().slice(0, 10);
}

function chartStartDate(periodDate) {
    return shiftIsoDate(periodDate, -1);
}

function chartEndDate(periodDate) {
    return shiftIsoDate(periodEndDate(periodDate).toISOString().slice(0, 10), -1);
}

function groupSnapshotsForChart(snapshots, periodDate) {
    if (!snapshots || snapshots.length === 0) {
        return [];
    }

    const periodStartDate = periodDate ?? new Date().toISOString().slice(0, 7) + "-01";
    const startDate = chartStartDate(periodStartDate);
    const endDate = chartEndDate(periodStartDate);
    const todayDate = new Date().toISOString().slice(0, 10);
    const shouldMarkToday = todayDate >= startDate && todayDate <= endDate;
    const sortedSnapshots = [...snapshots].sort((left, right) => left.snapshotDate.localeCompare(right.snapshotDate));
    const preferredCurrency = sortedSnapshots.some((snapshot) => snapshot.currencyCode === (userSettings?.defaultCurrency ?? "PLN"))
            ? userSettings?.defaultCurrency ?? "PLN"
            : sortedSnapshots[0].currencyCode;
    const latestAmountByAccount = new Map();
    const points = [];
    let todayAdded = false;

    sortedSnapshots
            .filter((snapshot) => snapshot.currencyCode === preferredCurrency && snapshot.snapshotDate < startDate)
            .forEach((snapshot) => {
                latestAmountByAccount.set(snapshot.accountId, Number(snapshot.balance));
            });

    const monthSnapshotsByDate = new Map();
    sortedSnapshots
            .filter((snapshot) =>
                    snapshot.currencyCode === preferredCurrency
                    && snapshot.snapshotDate >= startDate
                    && snapshot.snapshotDate <= endDate
            )
            .forEach((snapshot) => {
                const snapshotsForDate = monthSnapshotsByDate.get(snapshot.snapshotDate) ?? [];
                snapshotsForDate.push(snapshot);
                monthSnapshotsByDate.set(snapshot.snapshotDate, snapshotsForDate);
            });

    if (!monthSnapshotsByDate.has(startDate) && latestAmountByAccount.size > 0) {
        points.push({
            date: startDate,
            amount: sumLatestAmounts(latestAmountByAccount),
            currencyCode: preferredCurrency,
            type: shouldMarkToday && todayDate === startDate ? "today" : "baseline"
        });
        todayAdded = shouldMarkToday && todayDate === startDate;
    }

    [...monthSnapshotsByDate.entries()].forEach(([date, snapshotsForDate]) => {
        if (shouldMarkToday && !todayAdded && todayDate < date && latestAmountByAccount.size > 0) {
            points.push({
                date: todayDate,
                amount: sumLatestAmounts(latestAmountByAccount),
                currencyCode: preferredCurrency,
                type: "today"
            });
            todayAdded = true;
        }

        snapshotsForDate.forEach((snapshot) => {
            latestAmountByAccount.set(snapshot.accountId, Number(snapshot.balance));
        });
        points.push({
            date,
            amount: sumLatestAmounts(latestAmountByAccount),
            currencyCode: preferredCurrency,
            type: shouldMarkToday && date === todayDate ? "snapshot-today" : "snapshot"
        });

        if (shouldMarkToday && date === todayDate) {
            todayAdded = true;
        }
    });

    if (shouldMarkToday && !todayAdded && latestAmountByAccount.size > 0) {
        points.push({
            date: todayDate,
            amount: sumLatestAmounts(latestAmountByAccount),
            currencyCode: preferredCurrency,
            type: "today"
        });
        todayAdded = true;
    }

    if (latestAmountByAccount.size > 0 && points.at(-1)?.date !== endDate) {
        points.push({
            date: endDate,
            amount: sumLatestAmounts(latestAmountByAccount),
            currencyCode: preferredCurrency,
            type: "end"
        });
    }

    return points;
}

function sumLatestAmounts(latestAmountByAccount) {
    return [...latestAmountByAccount.values()].reduce((sum, amount) => sum + amount, 0);
}

function linePath(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function areaPath(points, height, bottomPadding) {
    if (points.length < 2) {
        return "";
    }

    const bottom = height - bottomPadding;
    return `${linePath(points)} L ${points.at(-1).x} ${bottom} L ${points[0].x} ${bottom} Z`;
}

function chartDateLabel(date) {
    return new Intl.DateTimeFormat(currentLanguage === "en" ? "en-US" : "pl-PL", {
        day: "2-digit",
        month: "2-digit"
    }).format(new Date(`${date}T00:00:00Z`));
}

function chartAmountLabel(point) {
    return MoneySnapshotUi.formatMoneyValue(point.amount, userSettings);
}

function chartPointClass(point) {
    if (point.type === "today") {
        return "chart-point chart-point-today";
    }

    if (point.type === "snapshot-today") {
        return "chart-point chart-point-overlap";
    }

    return "chart-point";
}

function chartValueLabel(point, index, points, height, bottomPadding) {
    const previousPoint = points[index - 1];
    const nextPoint = points[index + 1];
    const isNearPrevious = previousPoint && Math.abs(point.x - previousPoint.x) < 96;
    const isNearNext = nextPoint && Math.abs(nextPoint.x - point.x) < 96;
    const isCrowded = isNearPrevious || isNearNext;
    const shouldPlaceBelow = isCrowded && index % 2 === 1;
    const y = shouldPlaceBelow
            ? Math.min(height - bottomPadding - 8, point.y + 22)
            : Math.max(16, point.y - 12);
    const anchor = point.x < 92 ? "start" : point.x > 548 ? "end" : "middle";

    return `<text class="chart-value-label" x="${point.x}" y="${y}" text-anchor="${anchor}">${chartAmountLabel(point)}</text>`;
}

function renderSnapshotChart(snapshots, periodDate) {
    const chartPeriodDate = periodDate ?? new Date().toISOString().slice(0, 7) + "-01";
    const data = groupSnapshotsForChart(snapshots, chartPeriodDate);
    if (data.length === 0) {
        chartElement.innerHTML = `<div class="chart-empty">-</div>`;
        return;
    }

    const width = 640;
    const height = 240;
    const leftPadding = 48;
    const rightPadding = 26;
    const topPadding = 34;
    const bottomPadding = 34;
    const startDateLabel = chartStartDate(chartPeriodDate);
    const endDateLabel = chartEndDate(chartPeriodDate);
    const startTime = new Date(`${startDateLabel}T00:00:00Z`).getTime();
    const endTime = new Date(`${endDateLabel}T00:00:00Z`).getTime();
    const timeRange = endTime - startTime || 1;
    const minAmount = Math.min(...data.map((point) => point.amount));
    const maxAmount = Math.max(...data.map((point) => point.amount));
    const amountRange = maxAmount - minAmount || 1;

    const points = data.map((point) => ({
        ...point,
        x: leftPadding + ((new Date(`${point.date}T00:00:00Z`).getTime() - startTime) * (width - leftPadding - rightPadding)) / timeRange,
        y: height - bottomPadding - ((point.amount - minAmount) * (height - topPadding - bottomPadding)) / amountRange
    }));
    const visiblePoints = points.filter((point) => point.type !== "end");

    const line = linePath(points);
    const area = areaPath(points, height, bottomPadding);

    chartElement.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Snapshot balance line chart">
            <path class="chart-area" d="${area}"></path>
            <path class="chart-line" d="${line}"></path>
            ${visiblePoints.map((point) => `<circle class="${chartPointClass(point)}" cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}
            ${visiblePoints.map((point, index) => chartValueLabel(point, index, visiblePoints, height, bottomPadding)).join("")}
            <text class="chart-axis-label" x="${leftPadding}" y="${height - 8}">${chartDateLabel(startDateLabel)}</text>
            <text class="chart-axis-label" x="${width - rightPadding}" y="${height - 8}" text-anchor="end">${chartDateLabel(endDateLabel)}</text>
        </svg>
    `;
}

async function loadSnapshotPanel() {
    const response = await fetch("/api/home/snapshot-panel");
    if (!response.ok) {
        throw new Error("Cannot load snapshot panel.");
    }

    const panel = await response.json();
    renderSnapshotPanel(panel);
    return panel;
}

async function loadSnapshotChart() {
    const response = await fetch("/api/snapshots");
    if (!response.ok) {
        throw new Error("Cannot load snapshot chart.");
    }

    return response.json();
}

async function loadHomeData() {
    const [panel, snapshots] = await Promise.all([
        loadSnapshotPanel(),
        loadSnapshotChart()
    ]);
    renderSnapshotChart(snapshots, panel.periodDate);
}

MoneySnapshotI18n.init({
    endpoint: "/api/home/messages",
    onLanguageChange: ({language}) => {
        currentLanguage = language;
        loadHomeData().catch((error) => {
            console.error(error);
        });
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadHomeData)
        .catch((error) => {
            console.error(error);
        });
