const periodElement = document.querySelector("#snapshot-panel-period");
const changePercentElement = document.querySelector("#snapshot-panel-change-percent");
const accountsElement = document.querySelector("#snapshot-panel-accounts");
const billsElement = document.querySelector("#snapshot-panel-bills");
const liabilitiesElement = document.querySelector("#snapshot-panel-liabilities");
const installmentsElement = document.querySelector("#snapshot-panel-installments");
const balanceElement = document.querySelector("#snapshot-panel-balance");
const changeElement = document.querySelector("#snapshot-panel-change");
const chartElement = document.querySelector("#snapshot-panel-chart");
const openSnapshotFormModalButton = document.querySelector("#open-snapshot-form-modal");
const snapshotFormModalElement = document.querySelector("#snapshot-form-modal");
const openBulkSnapshotFormModalButton = document.querySelector("#open-bulk-snapshot-form-modal");
const bulkSnapshotFormModalElement = document.querySelector("#bulk-snapshot-form-modal");
const openHomeLiabilityRepaymentModalButton = document.querySelector("#open-home-liability-repayment-modal");
const homeLiabilityRepaymentModalElement = document.querySelector("#home-liability-repayment-modal");
const snapshotFormModal = snapshotFormModalElement
    ? MoneySnapshotUi.createModal({
        modalSelector: "#snapshot-form-modal",
        closeSelectors: ["#snapshot-form-modal [data-snapshot-modal-close]"]
    })
    : null;
const bulkSnapshotFormModal = bulkSnapshotFormModalElement
    ? MoneySnapshotUi.createModal({
        modalSelector: "#bulk-snapshot-form-modal",
        closeSelectors: ["#bulk-snapshot-form-modal [data-bulk-snapshot-modal-close]"]
    })
    : null;
const homeLiabilityRepaymentModal = homeLiabilityRepaymentModalElement
    ? MoneySnapshotUi.createModal({
        modalSelector: "#home-liability-repayment-modal",
        closeSelectors: ["#home-liability-repayment-modal [data-home-liability-repayment-modal-close]"]
    })
    : null;
const snapshotFormElement = snapshotFormModalElement?.querySelector("[data-snapshot-form]") ?? null;
const bulkSnapshotFormElement = bulkSnapshotFormModalElement?.querySelector("[data-bulk-snapshot-form]") ?? null;
const homeLiabilityRepaymentForm = document.getElementById("home-liability-repayment-form");
const homeLiabilityRepaymentFormMessageContainer = document.getElementById("home-liability-repayment-form-message-container");
const homeLiabilityRepaymentFormMessage = document.getElementById("home-liability-repayment-form-message");
const homeLiabilityRepaymentSubmitButton = document.getElementById("home-liability-repayment-submit");
const homeLiabilityRepaymentSelect = document.getElementById("home-liability-repayment-liability");
const homeLiabilityRepaymentDateInput = document.getElementById("home-liability-repayment-date");
const homeLiabilityRepaymentSourceTypeInput = document.getElementById("home-liability-repayment-source-type");
const homeLiabilityRepaymentSourceAmountInput = document.getElementById("home-liability-repayment-source-amount");
const homeLiabilityRepaymentFinalAmountInput = document.getElementById("home-liability-repayment-final-amount");
const homeLiabilityRepaymentSourceLabel = document.getElementById("home-liability-repayment-source-label");
const homeLiabilityRepaymentNoteInput = document.getElementById("home-liability-repayment-note");
const homeLiabilityRepaymentFormControls = {
    liabilityId: homeLiabilityRepaymentSelect,
    repaymentDate: homeLiabilityRepaymentDateInput,
    sourceType: homeLiabilityRepaymentSourceTypeInput,
    sourceAmount: homeLiabilityRepaymentSourceAmountInput
};

let currentLanguage = "pl";
let userSettings = null;
let homeMessages = {};
let liabilityRepaymentMessages = {};
let snapshotFormController = null;
let snapshotFormControllerPromise = null;
let bulkSnapshotFormController = null;
let bulkSnapshotFormControllerPromise = null;
let cachedLiabilities = [];
let selectedHomeRepaymentLiabilityId = "";
const toastManager = MoneySnapshotUi.createToastManager({
    durationMs: 4200
});

function formatCurrencyAmount({currencyCode, amount}, includeSign = false) {
    const numericAmount = Number(amount);
    const sign = includeSign && numericAmount > 0 ? "+" : "";
    return `${sign}${MoneySnapshotUi.formatMoneyValue(numericAmount, userSettings)}`;
}

function shouldOpenModalFromClick(event) {
    return event.button === 0
        && !event.defaultPrevented
        && !event.metaKey
        && !event.ctrlKey
        && !event.shiftKey
        && !event.altKey;
}

function todayIsoDate() {
    return MoneySnapshotUi.localIsoDate();
}

function normalizeDecimalInput(rawValue) {
    const trimmedValue = `${rawValue ?? ""}`.trim();
    if (!trimmedValue) {
        return null;
    }

    const normalizedValue = trimmedValue.replace(/\s+/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,4})?$/.test(normalizedValue)) {
        return null;
    }

    return normalizedValue;
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

function renderLiabilitiesSummary(summary) {
    if (liabilitiesElement) {
        liabilitiesElement.textContent = summary ? MoneySnapshotUi.formatMoneyValue(Number(summary.currentDebtAmount ?? 0), userSettings) : "-";
    }

    if (installmentsElement) {
        const numericValue = summary ? -Math.abs(Number(summary.monthlyDueAmount ?? 0)) : null;
        installmentsElement.textContent = numericValue === null ? "-" : MoneySnapshotUi.formatMoneyValue(numericValue, userSettings);
    }
}

function aggregateBillsByCurrency(bills) {
    const totalsByCurrency = new Map();

    (bills ?? [])
        .filter((bill) => bill?.status === "ACTIVE")
        .forEach((bill) => {
            const currencyCode = `${bill.currencyCode ?? ""}`.trim().toUpperCase();
            const amount = Number(bill.amount ?? 0);
            if (!currencyCode || !Number.isFinite(amount)) {
                return;
            }

            totalsByCurrency.set(currencyCode, (totalsByCurrency.get(currencyCode) ?? 0) + amount);
        });

    return [...totalsByCurrency.entries()]
        .sort(([leftCurrency], [rightCurrency]) => leftCurrency.localeCompare(rightCurrency))
        .map(([currencyCode, amount]) => ({
            currencyCode,
            amount: -Math.abs(amount)
        }));
}

function renderBillsSummary(bills) {
    if (!billsElement) {
        return;
    }

    if (bills === null) {
        billsElement.textContent = currentMessages["home.summary.unavailable"] ?? "-";
        return;
    }

    billsElement.textContent = formatAmountList(aggregateBillsByCurrency(bills));
}

function configuredPeriodEndDate(periodDate) {
    const startDate = new Date(`${periodDate}T00:00:00Z`);
    const billingMonthEndDay = Math.min(Math.max(userSettings?.billingMonthStartDay ?? 1, 1), 31);
    const currentMonthEnd = new Date(Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            Math.min(billingMonthEndDay, new Date(Date.UTC(
                    startDate.getUTCFullYear(),
                    startDate.getUTCMonth() + 1,
                    0
            )).getUTCDate())
    ));

    if (currentMonthEnd.toISOString().slice(0, 10) >= periodDate) {
        return currentMonthEnd;
    }

    const nextMonthEnd = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1));
    const lastDayOfNextMonth = new Date(Date.UTC(
            nextMonthEnd.getUTCFullYear(),
            nextMonthEnd.getUTCMonth() + 1,
            0
    )).getUTCDate();
    nextMonthEnd.setUTCDate(Math.min(billingMonthEndDay, lastDayOfNextMonth));
    return nextMonthEnd;
}

function periodEndDate(periodDate) {
    return configuredPeriodEndDate(periodDate);
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
    return periodEndDate(periodDate).toISOString().slice(0, 10);
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
    const sign = point.amount > 0 ? "+" : "";
    return `${sign}${MoneySnapshotUi.formatMoneyValue(point.amount, userSettings)}`;
}

function chartReferenceAmount(summary) {
    if (!summary) {
        return null;
    }

    const amount = Number(summary.monthlyDueAmount ?? 0);
    return Number.isFinite(amount) ? Math.abs(amount) : null;
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

function renderSnapshotChart(chartPoints, periodDate, liabilitiesSummary = null) {
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
    const referenceAmount = chartReferenceAmount(liabilitiesSummary);
    const chartMinAmount = referenceAmount === null ? minAmount : Math.min(minAmount, referenceAmount);
    const chartMaxAmount = referenceAmount === null ? maxAmount : Math.max(maxAmount, referenceAmount);
    const amountRange = chartMaxAmount - chartMinAmount || 1;

    const renderedPoints = data.map((point) => ({
        ...point,
        x: leftPadding + ((new Date(`${point.date}T00:00:00Z`).getTime() - startTime) * (width - leftPadding - rightPadding)) / timeRange,
        y: height - bottomPadding - ((point.amount - chartMinAmount) * (height - topPadding - bottomPadding)) / amountRange
    }));
    const visiblePoints = renderedPoints.filter((point) => ["baseline", "snapshot", "today", "snapshot-today"].includes(point.type));
    const labelPoints = selectChartLabelPoints(visiblePoints);

    const line = linePath(renderedPoints);
    const area = areaPath(renderedPoints, height, bottomPadding);
    const referenceY = referenceAmount === null
        ? null
        : height - bottomPadding - ((referenceAmount - chartMinAmount) * (height - topPadding - bottomPadding)) / amountRange;

    chartElement.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Snapshot balance line chart">
            <path class="chart-area" d="${area}"></path>
            <path class="chart-line" d="${line}"></path>
            ${referenceY === null ? "" : `<line class="chart-reference-line" x1="${leftPadding}" y1="${referenceY}" x2="${width - rightPadding}" y2="${referenceY}"></line>`}
            ${referenceY === null ? "" : `<text class="chart-reference-label" x="${width - rightPadding}" y="${Math.max(18, referenceY - 8)}" text-anchor="end">${homeMessages["home.summary.installments"] ?? "Suma rat"}</text>`}
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

async function loadLiabilitiesSummary() {
    const response = await fetch("/api/liabilities/summary");
    if (!response.ok) {
        throw new Error("Cannot load liabilities summary.");
    }

    return response.json();
}

async function loadBillsSummary() {
    const response = await fetch("/api/bills");
    if (!response.ok) {
        throw new Error("Cannot load bills summary.");
    }

    return response.json();
}

async function loadHomeData() {
    const [panel, liabilitiesSummary, billsSummary] = await Promise.all([
        loadSnapshotPanel(),
        loadLiabilitiesSummary().catch((error) => {
            console.error(error);
            return null;
        }),
        loadBillsSummary().catch((error) => {
            console.error(error);
            return null;
        })
    ]);

    renderSnapshotChart(panel.chartPoints ?? [], panel.periodDate, liabilitiesSummary);
    renderLiabilitiesSummary(liabilitiesSummary);
    renderBillsSummary(billsSummary);
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

async function ensureBulkSnapshotFormController() {
    if (bulkSnapshotFormController) {
        return bulkSnapshotFormController;
    }

    if (bulkSnapshotFormControllerPromise) {
        return bulkSnapshotFormControllerPromise;
    }

    if (!bulkSnapshotFormElement || !window.MoneySnapshotBulkSnapshotForm) {
        return null;
    }

    bulkSnapshotFormControllerPromise = window.MoneySnapshotBulkSnapshotForm.init({
        root: bulkSnapshotFormElement,
        messages: homeMessages,
        userSettings,
        autoPrepare: false,
        redirectOnSuccess: false,
        onSuccess: async ({savedSnapshots, controller}) => {
            controller.resetForm();
            bulkSnapshotFormModal?.close();
            await loadHomeData();
            const successMessageTemplate = homeMessages["snapshots.bulk.success"] ?? "";
            const successMessage = successMessageTemplate.replace("{count}", String(savedSnapshots.length));
            toastManager.show(successMessage, {type: "success"});
        }
    })
        .then((controller) => {
            bulkSnapshotFormController = controller;
            return controller;
        })
        .catch((error) => {
            bulkSnapshotFormControllerPromise = null;
            throw error;
        });

    return bulkSnapshotFormControllerPromise;
}

function setHomeLiabilityRepaymentFormMessage(text, type = "") {
    if (!homeLiabilityRepaymentFormMessage) {
        return;
    }

    homeLiabilityRepaymentFormMessage.textContent = text;
    homeLiabilityRepaymentFormMessage.dataset.type = type;
    if (homeLiabilityRepaymentFormMessageContainer) {
        homeLiabilityRepaymentFormMessageContainer.dataset.type = type || "error";
        homeLiabilityRepaymentFormMessageContainer.hidden = !text;
    }
}

function clearHomeLiabilityRepaymentFieldHighlights() {
    Object.values(homeLiabilityRepaymentFormControls).forEach((input) => input?.removeAttribute("aria-invalid"));
}

function highlightHomeLiabilityRepaymentField(input) {
    input?.setAttribute("aria-invalid", "true");
}

function applyHomeLiabilityRepaymentFieldHighlights(fieldErrors = {}) {
    if (fieldErrors.liabilityId) {
        highlightHomeLiabilityRepaymentField(homeLiabilityRepaymentSelect);
    }
    if (fieldErrors.repaymentDate) {
        highlightHomeLiabilityRepaymentField(homeLiabilityRepaymentDateInput);
    }
    if (fieldErrors.sourceType) {
        highlightHomeLiabilityRepaymentField(homeLiabilityRepaymentSourceTypeInput);
    }
    if (fieldErrors.sourceAmount) {
        highlightHomeLiabilityRepaymentField(homeLiabilityRepaymentSourceAmountInput);
    }
}

function focusFirstHomeLiabilityRepaymentHighlightedField() {
    Object.values(homeLiabilityRepaymentFormControls).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
}

async function readErrorPayload(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

function homeRepaymentSourceType() {
    return homeLiabilityRepaymentSourceTypeInput?.value === "CURRENT_AMOUNT" ? "CURRENT_AMOUNT" : "REPAYMENT_AMOUNT";
}

function selectedHomeRepaymentLiability() {
    return cachedLiabilities.find((liability) => liability.id === homeLiabilityRepaymentSelect?.value) ?? null;
}

function applyHomeRepaymentSourceFieldLabel() {
    if (!homeLiabilityRepaymentSourceLabel) {
        return;
    }

    homeLiabilityRepaymentSourceLabel.textContent = homeRepaymentSourceType() === "CURRENT_AMOUNT"
        ? (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountCurrentAmount"] ?? "Aktualne saldo")
        : (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountRepaymentAmount"] ?? "Kwota spłaty");
}

function updateHomeRepaymentFinalAmountPreview() {
    if (!homeLiabilityRepaymentFinalAmountInput) {
        return;
    }

    const rawValue = normalizeDecimalInput(homeLiabilityRepaymentSourceAmountInput?.value);
    if (rawValue === null) {
        homeLiabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    const sourceValue = Number(rawValue);
    const selectedLiability = selectedHomeRepaymentLiability();
    if (!Number.isFinite(sourceValue) || !selectedLiability) {
        homeLiabilityRepaymentFinalAmountInput.value = "-";
        return;
    }

    if (homeRepaymentSourceType() === "CURRENT_AMOUNT") {
        homeLiabilityRepaymentFinalAmountInput.value = MoneySnapshotUi.formatMoneyValue(sourceValue, userSettings);
        return;
    }

    homeLiabilityRepaymentFinalAmountInput.value = MoneySnapshotUi.formatMoneyValue(
        Number(selectedLiability.currentAmount ?? 0) - sourceValue,
        userSettings
    );
}

function syncHomeRepaymentSourceAmountFromSelection() {
    if (!homeLiabilityRepaymentSourceAmountInput) {
        return;
    }

    const currentAmount = Number(selectedHomeRepaymentLiability()?.currentAmount ?? 0);
    homeLiabilityRepaymentSourceAmountInput.value = homeRepaymentSourceType() === "CURRENT_AMOUNT" ? `${currentAmount}` : "0";
    updateHomeRepaymentFinalAmountPreview();
}

function setHomeRepaymentInputsEnabled(hasLiabilities) {
    if (homeLiabilityRepaymentSourceTypeInput) {
        homeLiabilityRepaymentSourceTypeInput.disabled = !hasLiabilities;
    }
    if (homeLiabilityRepaymentSourceAmountInput) {
        homeLiabilityRepaymentSourceAmountInput.disabled = !hasLiabilities;
    }
    if (homeLiabilityRepaymentFinalAmountInput) {
        homeLiabilityRepaymentFinalAmountInput.disabled = !hasLiabilities;
    }
}

function renderHomeRepaymentLiabilityOptions() {
    if (!homeLiabilityRepaymentSelect) {
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = liabilityRepaymentMessages["liabilityRepayment.form.liabilityPlaceholder"] ?? "";

    homeLiabilityRepaymentSelect.replaceChildren(
        placeholder,
        ...cachedLiabilities.map((liability) => {
            const option = document.createElement("option");
            option.value = liability.id;
            option.textContent = `${liability.name} · ${liability.bankName} · ${MoneySnapshotUi.formatMoneyValue(Number(liability.currentAmount ?? 0), userSettings)}`;
            return option;
        })
    );

    if (selectedHomeRepaymentLiabilityId) {
        homeLiabilityRepaymentSelect.value = selectedHomeRepaymentLiabilityId;
    }

    const hasLiabilities = cachedLiabilities.length > 0;
    homeLiabilityRepaymentSelect.disabled = !hasLiabilities;
    setHomeRepaymentInputsEnabled(hasLiabilities);
    if (homeLiabilityRepaymentSubmitButton) {
        homeLiabilityRepaymentSubmitButton.disabled = !hasLiabilities;
    }

    if (!hasLiabilities) {
        setHomeLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.noLiabilities"] ?? "", "error");
    } else if (homeLiabilityRepaymentFormMessage?.dataset.type === "error") {
        setHomeLiabilityRepaymentFormMessage("", "");
    }

    applyHomeRepaymentSourceFieldLabel();
    syncHomeRepaymentSourceAmountFromSelection();
}

async function loadHomeLiabilityRepaymentMessages(language) {
    const response = await fetch(`/api/liability-repayment/messages?lang=${encodeURIComponent(language)}`);
    if (!response.ok) {
        throw new Error("Cannot load liability repayment messages");
    }

    liabilityRepaymentMessages = await response.json();
    if (homeLiabilityRepaymentModalElement) {
        MoneySnapshotI18n.applyMessages(
            liabilityRepaymentMessages,
            language,
            homeLiabilityRepaymentModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
        );
    }
    renderHomeRepaymentLiabilityOptions();
}

async function loadHomeLiabilities() {
    const response = await fetch("/api/liabilities");
    if (!response.ok) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.loadLiabilities"] ?? "Cannot load liabilities.");
    }

    const dashboard = await response.json();
    cachedLiabilities = dashboard.liabilities ?? [];
    renderHomeRepaymentLiabilityOptions();
}

function initializeHomeRepaymentDateDefaults() {
    if (homeLiabilityRepaymentDateInput && !homeLiabilityRepaymentDateInput.value) {
        homeLiabilityRepaymentDateInput.value = todayIsoDate();
    }
}

function homeRepaymentPayloadFromForm() {
    return {
        repaymentDate: homeLiabilityRepaymentDateInput?.value || null,
        sourceType: homeRepaymentSourceType(),
        sourceAmount: normalizeDecimalInput(homeLiabilityRepaymentSourceAmountInput?.value),
        note: homeLiabilityRepaymentNoteInput?.value.trim() ?? ""
    };
}

function validateHomeRepaymentPayload(payload) {
    if (!homeLiabilityRepaymentSelect?.value || !payload.repaymentDate || !payload.sourceType || !payload.sourceAmount) {
        return "required";
    }

    const selectedLiability = selectedHomeRepaymentLiability();
    if (!selectedLiability) {
        return "required";
    }

    const sourceValue = Number(payload.sourceAmount);
    const baseValue = Number(selectedLiability.currentAmount ?? 0);
    if (!Number.isFinite(sourceValue) || sourceValue < 0 || sourceValue > baseValue) {
        return "exceedsBalance";
    }

    return "";
}

async function saveHomeRepayment(liabilityId, payload) {
    const response = await fetch(`/api/liabilities/${encodeURIComponent(liabilityId)}/repayments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    const errorPayload = response.ok ? null : await readErrorPayload(response);

    if (response.status === 404) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.repaymentNotFound"] ?? "Repayment not found.");
    }

    if (response.status === 400) {
        if (errorPayload?.fieldErrors) {
            const validationError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "Validation failed.");
            validationError.fieldErrors = errorPayload.fieldErrors;
            throw validationError;
        }
        if (errorPayload?.message === "Repayments can only be registered for active liabilities.") {
            const inactiveLiabilityError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.inactiveLiability"] ?? "Repayments can only be registered for active liabilities.");
            inactiveLiabilityError.fieldErrors = {liabilityId: "inactive"};
            throw inactiveLiabilityError;
        }
        if (errorPayload?.message === "Repayment amount cannot exceed current liability amount.") {
            const amountError = new Error(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "Validation failed.");
            amountError.fieldErrors = {sourceAmount: "exceedsBalance"};
            throw amountError;
        }
        throw new Error(errorPayload?.message ?? liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "Validation failed.");
    }

    if (!response.ok) {
        throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.create"] ?? "Cannot save repayment.");
    }

    return response.json();
}

function resetHomeLiabilityRepaymentForm() {
    if (!homeLiabilityRepaymentForm) {
        return;
    }

    homeLiabilityRepaymentForm.reset();
    clearHomeLiabilityRepaymentFieldHighlights();
    setHomeLiabilityRepaymentFormMessage("");
    if (homeLiabilityRepaymentSourceTypeInput) {
        homeLiabilityRepaymentSourceTypeInput.value = "REPAYMENT_AMOUNT";
    }
    initializeHomeRepaymentDateDefaults();
    renderHomeRepaymentLiabilityOptions();
    if (homeLiabilityRepaymentSubmitButton) {
        homeLiabilityRepaymentSubmitButton.disabled = false;
    }
}

async function openHomeLiabilityRepaymentModal(trigger) {
    await loadHomeLiabilities();
    resetHomeLiabilityRepaymentForm();
    homeLiabilityRepaymentModal?.open({trigger});
}

function setupHomeLiabilityRepaymentModal() {
    if (!homeLiabilityRepaymentForm || !openHomeLiabilityRepaymentModalButton) {
        return;
    }

    initializeHomeRepaymentDateDefaults();
    renderHomeRepaymentLiabilityOptions();

    homeLiabilityRepaymentSelect?.addEventListener("change", () => {
        selectedHomeRepaymentLiabilityId = homeLiabilityRepaymentSelect.value;
        syncHomeRepaymentSourceAmountFromSelection();
    });

    homeLiabilityRepaymentSourceTypeInput?.addEventListener("change", () => {
        applyHomeRepaymentSourceFieldLabel();
        syncHomeRepaymentSourceAmountFromSelection();
    });

    homeLiabilityRepaymentSourceAmountInput?.addEventListener("input", updateHomeRepaymentFinalAmountPreview);
    homeLiabilityRepaymentDateInput?.addEventListener("input", updateHomeRepaymentFinalAmountPreview);

    Object.values(homeLiabilityRepaymentFormControls).forEach((input) => {
        input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
        input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
    });

    homeLiabilityRepaymentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearHomeLiabilityRepaymentFieldHighlights();

        const liabilityId = homeLiabilityRepaymentSelect?.value ?? "";
        const payload = homeRepaymentPayloadFromForm();
        const validationError = validateHomeRepaymentPayload(payload);
        if (validationError === "required") {
            applyHomeLiabilityRepaymentFieldHighlights({
                liabilityId: !liabilityId,
                repaymentDate: !payload.repaymentDate,
                sourceType: !payload.sourceType,
                sourceAmount: !payload.sourceAmount
            });
            setHomeLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "", "error");
            focusFirstHomeLiabilityRepaymentHighlightedField();
            return;
        }
        if (validationError === "exceedsBalance") {
            highlightHomeLiabilityRepaymentField(homeLiabilityRepaymentSourceAmountInput);
            setHomeLiabilityRepaymentFormMessage(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "", "error");
            focusFirstHomeLiabilityRepaymentHighlightedField();
            return;
        }

        if (homeLiabilityRepaymentSubmitButton) {
            homeLiabilityRepaymentSubmitButton.disabled = true;
        }
        setHomeLiabilityRepaymentFormMessage("");

        try {
            await saveHomeRepayment(liabilityId, payload);
            homeLiabilityRepaymentModal?.close();
            resetHomeLiabilityRepaymentForm();
            await loadHomeData();
            toastManager.clear();
            toastManager.show(liabilityRepaymentMessages["liabilityRepayment.form.success"] ?? "", {type: "success"});
        } catch (error) {
            if (error.fieldErrors) {
                applyHomeLiabilityRepaymentFieldHighlights(error.fieldErrors);
                focusFirstHomeLiabilityRepaymentHighlightedField();
            }
            setHomeLiabilityRepaymentFormMessage(error.message, "error");
            if (homeLiabilityRepaymentSubmitButton) {
                homeLiabilityRepaymentSubmitButton.disabled = false;
            }
        }
    });

    openHomeLiabilityRepaymentModalButton.addEventListener("click", async (event) => {
        if (!shouldOpenModalFromClick(event)) {
            return;
        }

        event.preventDefault();

        try {
            await openHomeLiabilityRepaymentModal(openHomeLiabilityRepaymentModalButton);
        } catch (error) {
            console.error(error);
            toastManager.clear();
            toastManager.show(error.message, {type: "error"});
            window.location.href = openHomeLiabilityRepaymentModalButton.href;
        }
    });
}

MoneySnapshotI18n.init({
    endpoint: "/api/home/messages",
    onLanguageChange: ({language, messages}) => {
        currentLanguage = language;
        homeMessages = messages;
        snapshotFormController?.handleLanguageChange(messages);
        bulkSnapshotFormController?.handleLanguageChange(messages);
        loadHomeLiabilityRepaymentMessages(language).catch((error) => {
            console.error(error);
        });
        loadHomeData().catch((error) => {
            console.error(error);
        });
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
            snapshotFormController?.updateUserSettings(settings);
            bulkSnapshotFormController?.updateUserSettings(settings);
        })
        .then(() => {
            setupHomeLiabilityRepaymentModal();
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

openBulkSnapshotFormModalButton?.addEventListener("click", async (event) => {
    if (!bulkSnapshotFormModal || !bulkSnapshotFormElement || !window.MoneySnapshotBulkSnapshotForm) {
        return;
    }

    event.preventDefault();

    try {
        const controller = await ensureBulkSnapshotFormController();
        if (!controller) {
            window.location.href = openBulkSnapshotFormModalButton.href;
            return;
        }

        await controller.prepare({forceReload: true});
        controller.resetForm();
        controller.clearMessage();
        bulkSnapshotFormModal.open({
            trigger: openBulkSnapshotFormModalButton
        });
        window.requestAnimationFrame(() => {
            controller.focus();
        });
    } catch (error) {
        console.error(error);
        window.location.href = openBulkSnapshotFormModalButton.href;
    }
});
