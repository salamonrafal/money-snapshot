const periodElement = document.querySelector("#snapshot-panel-period");
const changePercentElement = document.querySelector("#snapshot-panel-change-percent");
const accountsElement = document.querySelector("#snapshot-panel-accounts");
const balanceElement = document.querySelector("#snapshot-panel-balance");
const changeElement = document.querySelector("#snapshot-panel-change");
const chartElement = document.querySelector("#snapshot-panel-chart");
const openSnapshotFormModalButton = document.querySelector("#open-snapshot-form-modal");
const snapshotFormModalElement = document.querySelector("#snapshot-form-modal");
const snapshotFormModal = snapshotFormModalElement
    ? MoneySnapshotUi.createModal({
        modalSelector: "#snapshot-form-modal",
        closeSelectors: ["#snapshot-form-modal [data-snapshot-modal-close]"]
    })
    : null;
const snapshotFormElement = snapshotFormModalElement?.querySelector("[data-snapshot-form]") ?? null;

let currentLanguage = "pl";
let userSettings = null;
let homeMessages = {};
let snapshotFormController = null;
let snapshotFormControllerPromise = null;

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

function groupChartPoints(points) {
    if (!points || points.length === 0) {
        return [];
    }
    return points
            .map((point) => ({
                ...point,
                amount: Number(point.amount)
            }))
            .sort((left, right) => left.date.localeCompare(right.date));
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

function chartLabelPriority(point, index, points) {
    if (point.type === "snapshot-today") {
        return 5;
    }

    if (point.type === "today") {
        return 4;
    }

    if (index === 0 || index === points.length - 1) {
        return 3;
    }

    if (point.type === "snapshot") {
        return 2;
    }

    return 1;
}

function selectChartLabelPoints(points) {
    const selected = [];
    const horizontalGap = 88;
    const verticalGap = 28;

    points.forEach((point, index) => {
        const priority = chartLabelPriority(point, index, points);
        const conflictingIndex = selected.findIndex((selectedPoint) =>
            Math.abs(selectedPoint.x - point.x) < horizontalGap && Math.abs(selectedPoint.y - point.y) < verticalGap
        );

        if (conflictingIndex === -1) {
            selected.push({...point, labelIndex: index});
            return;
        }

        const conflictingPoint = selected[conflictingIndex];
        const conflictingPriority = chartLabelPriority(conflictingPoint, conflictingPoint.labelIndex, points);
        if (priority > conflictingPriority) {
            selected[conflictingIndex] = {...point, labelIndex: index};
        }
    });

    return selected.map(({labelIndex, ...point}) => ({...point, labelIndex})).sort((left, right) => left.labelIndex - right.labelIndex);
}

function renderSnapshotChart(chartPoints, periodDate) {
    const chartPeriodDate = periodDate ?? new Date().toISOString().slice(0, 7) + "-01";
    const data = groupChartPoints(chartPoints);
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

    const renderedPoints = data.map((point) => ({
        ...point,
        x: leftPadding + ((new Date(`${point.date}T00:00:00Z`).getTime() - startTime) * (width - leftPadding - rightPadding)) / timeRange,
        y: height - bottomPadding - ((point.amount - minAmount) * (height - topPadding - bottomPadding)) / amountRange
    }));
    const visiblePoints = renderedPoints.filter((point) => ["baseline", "snapshot", "today", "snapshot-today"].includes(point.type));
    const labelPoints = selectChartLabelPoints(visiblePoints);

    const line = linePath(renderedPoints);
    const area = areaPath(renderedPoints, height, bottomPadding);

    chartElement.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Snapshot balance line chart">
            <path class="chart-area" d="${area}"></path>
            <path class="chart-line" d="${line}"></path>
            ${visiblePoints.map((point) => `<circle class="${chartPointClass(point)}" cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}
            ${labelPoints.map((point) => chartValueLabel(point, point.labelIndex, visiblePoints, height, bottomPadding)).join("")}
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

async function loadHomeData() {
    const panel = await loadSnapshotPanel();
    renderSnapshotChart(panel.chartPoints ?? [], panel.periodDate);
}

async function ensureSnapshotFormController() {
    if (snapshotFormController) {
        return snapshotFormController;
    }

    if (snapshotFormControllerPromise) {
        return snapshotFormControllerPromise;
    }

    if (!snapshotFormElement || !window.MoneySnapshotSnapshotForm) {
        return null;
    }

    snapshotFormControllerPromise = window.MoneySnapshotSnapshotForm.init({
        root: snapshotFormElement,
        messages: homeMessages,
        userSettings,
        onSuccess: async ({rememberAccountEnabled, resetForm, setFormMessage}) => {
            resetForm();
            await loadHomeData();
            if (!rememberAccountEnabled) {
                snapshotFormModal?.close();
                return true;
            }

            setFormMessage(homeMessages["snapshots.form.success"] ?? "", "success");
            window.requestAnimationFrame(() => {
                snapshotFormController?.focus();
            });
            return true;
        }
    })
            .then((controller) => {
                snapshotFormController = controller;
                return controller;
            })
            .catch((error) => {
                snapshotFormControllerPromise = null;
                throw error;
            });

    return snapshotFormControllerPromise;
}

MoneySnapshotI18n.init({
    endpoint: "/api/home/messages",
    onLanguageChange: ({language, messages}) => {
        currentLanguage = language;
        homeMessages = messages;
        snapshotFormController?.handleLanguageChange(messages);
        loadHomeData().catch((error) => {
            console.error(error);
        });
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
            snapshotFormController?.updateUserSettings(settings);
        })
        .then(loadHomeData)
        .catch((error) => {
            console.error(error);
        });

openSnapshotFormModalButton?.addEventListener("click", async (event) => {
    if (!snapshotFormModal || !snapshotFormElement || !window.MoneySnapshotSnapshotForm) {
        return;
    }

    event.preventDefault();

    try {
        const controller = await ensureSnapshotFormController();
        if (!controller) {
            window.location.href = openSnapshotFormModalButton.href;
            return;
        }

        controller.resetForm();
        controller.clearMessage();
        snapshotFormModal.open({
            trigger: openSnapshotFormModalButton
        });
        window.requestAnimationFrame(() => {
            controller.focus();
        });
    } catch (error) {
        console.error(error);
        window.location.href = openSnapshotFormModalButton.href;
    }
});
