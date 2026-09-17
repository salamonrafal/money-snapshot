const periodComparisonList = document.querySelector("#period-comparison-list");
const rebuildCacheButton = document.querySelector("#rebuild-period-comparison-cache");
let messages = {};
let language = "pl";
let settings = null;
let loadedPeriods = [];

function escapeHtml(value) {
    return `${value ?? ""}`.replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[character]));
}
function periodLabel(date) {
    const formatted = new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(`${date}T00:00:00Z`));
    return formatted.charAt(0).toLocaleUpperCase(language) + formatted.slice(1);
}
function dateLabel(date) { return MoneySnapshotUi.formatDateValue(date, settings); }
function moneyLabel(value) { return MoneySnapshotUi.formatMoneyValue(Number(value), settings); }
function daysBetween(fromDate, toDate) {
    return Math.round((new Date(`${toDate}T00:00:00Z`) - new Date(`${fromDate}T00:00:00Z`)) / 86400000);
}
function chartSvg(currency, period) {
    const width = 760, height = 280, left = 72, right = 20, top = 24, bottom = 42;
    const allPoints = period.points.filter(point => point.currencyCode === currency);
    const chartEnd = period.endDate;
    const lastPoint = allPoints.at(-1);
    const chartPoints = period.index !== 0 && lastPoint && lastPoint.date < chartEnd
        ? [...allPoints, {date: chartEnd, currencyCode: currency, amount: lastPoint.amount, synthetic: true}]
        : allPoints;
    const values = chartPoints.map(point => Number(point.amount));
    const min = Math.min(...values, 0), max = Math.max(...values, 0), range = max - min || 1;
    const periodBaseline = new Date(`${period.startDate}T00:00:00Z`);
    periodBaseline.setUTCDate(periodBaseline.getUTCDate() - 1);
    const periodBaselineDate = periodBaseline.toISOString().slice(0, 10);
    const periodSpan = Math.max(1, daysBetween(periodBaselineDate, chartEnd));
    const x = date => left + (daysBetween(periodBaselineDate, date) / periodSpan) * (width - left - right);
    const y = value => top + ((max - value) / range) * (height - top - bottom);
    let previousAmount = null;
    const visiblePoints = chartPoints.filter((point, index) => {
        const amount = Number(point.amount);
        const changed = index === 0 || amount !== previousAmount || point.finalSnapshot || index === chartPoints.length - 1;
        previousAmount = amount;
        return changed;
    });
    const path = chartPoints.map((point, index) => `${index ? "L" : "M"} ${x(point.date)} ${y(Number(point.amount))}`).join(" ");
    const valueLabels = visiblePoints.filter(point => !point.synthetic).map(point => {
        const pointX = x(point.date);
        const pointY = y(Number(point.amount));
        const pointClass = point.finalSnapshot ? "period-comparison-point period-comparison-final-point" : "period-comparison-point";
        const finalLabel = point.finalSnapshot ? `<text class="period-comparison-final-label" x="${pointX}" y="${Math.max(top + 24, pointY - 25)}" text-anchor="middle">${escapeHtml(messages["reports.periodComparison.final"] ?? "Finalna")}</text>` : "";
        return `<circle class="${pointClass}" cx="${pointX}" cy="${pointY}" r="4"></circle><text class="period-comparison-value" x="${pointX}" y="${Math.max(top + 12, pointY - 10)}" text-anchor="middle">${escapeHtml(moneyLabel(point.amount))}</text>${finalLabel}`;
    }).join("");
    const labels = `<text class="period-comparison-axis-label" x="${left}" y="${height - 10}">${escapeHtml(messages["reports.periodComparison.start"] ?? "Początek okresu")}</text><text class="period-comparison-axis-label" x="${width - right}" y="${height - 10}" text-anchor="end">${escapeHtml(messages["reports.periodComparison.end"] ?? "Koniec okresu")}</text>`;
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(messages["reports.periodComparison.chartAria"] ?? "Period comparison chart")}"><line class="period-comparison-axis" x1="${left}" x2="${left}" y1="${top}" y2="${height-bottom}"></line><line class="period-comparison-axis" x1="${left}" x2="${width-right}" y1="${y(0)}" y2="${y(0)}"></line><path class="period-comparison-line" style="stroke:var(--accent)" d="${path}"></path>${valueLabels}${labels}</svg>`;
}

function render(periods) {
    loadedPeriods = periods;
    if (!periods.length) { periodComparisonList.innerHTML = `<p class="form-message">${escapeHtml(messages["reports.periodComparison.empty"] ?? "Brak danych.")}</p>`; return; }
    const slider = document.createElement("div");
    slider.className = "period-comparison-slider";
    slider.tabIndex = 0;
    slider.setAttribute("aria-label", messages["reports.periodComparison.sliderAria"] ?? "Porównanie okresów");
    const track = document.createElement("div");
    track.className = "period-comparison-slider-track summary-slider-track";
    periods.forEach(period => {
        const slide = document.createElement("section");
        slide.className = "period-comparison-card summary-slide";
        slide.dataset.summarySlide = "";
        const title = period.index === 0 ? `${periodLabel(period.startDate)} (${messages["reports.periodComparison.current"] ?? "bieżący"})` : periodLabel(period.startDate);
        const currencies = [...new Set(period.points.map(point => point.currencyCode))].sort();
        slide.innerHTML = `<div class="section-header"><div><h2>${escapeHtml(title)}</h2></div></div><div class="period-comparison-currency-charts">${currencies.map(currency => `<div class="period-comparison-currency-chart"><div class="period-comparison-chart"><div class="period-comparison-chart-meta"><strong>${escapeHtml(currency)}</strong><span>${escapeHtml(dateLabel(period.startDate))} – ${escapeHtml(dateLabel(period.endDate))}</span></div>${chartSvg(currency, period)}</div>${periodDataTable(currency, period)}</div>`).join("")}</div>`;
        track.append(slide);
    });
    slider.append(track);
    const controls = document.createElement("div");
    controls.className = "summary-slider-controls period-comparison-slider-controls";
    controls.innerHTML = `<button type="button" class="summary-slider-arrow" data-summary-slide-previous aria-label="${escapeHtml(messages["reports.periodComparison.previousSlide"] ?? "Poprzedni okres")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg></button><div class="summary-slider-dots" role="tablist" aria-label="${escapeHtml(messages["reports.periodComparison.sliderAria"] ?? "Porównanie okresów")}">${periods.map((period, index) => `<button type="button" class="summary-slider-dot${index === 0 ? " is-active" : ""}" data-summary-slide-to="${index}" role="tab" aria-selected="${index === 0}" aria-label="${escapeHtml(periodLabel(period.startDate))}"></button>`).join("")}</div><button type="button" class="summary-slider-arrow" data-summary-slide-next aria-label="${escapeHtml(messages["reports.periodComparison.nextSlide"] ?? "Następny okres")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>`;
    periodComparisonList.replaceChildren(slider);
    slider.append(controls);
    window.MoneySnapshotSlider?.create(slider);
}

function periodDataTable(currency, period) {
    const rows = period.points
        .filter(point => point.currencyCode === currency)
        .map(point => `<tr><td>${escapeHtml(dateLabel(point.date))}${point.finalSnapshot ? ` <span class="period-comparison-final-badge">${escapeHtml(messages["reports.periodComparison.final"] ?? "Finalna")}</span>` : ""}</td><td class="numeric-cell">${escapeHtml(moneyLabel(point.amount))}</td></tr>`)
        .join("");
    return `<details class="period-comparison-data"><summary>${escapeHtml(messages["reports.periodComparison.data"] ?? "Pokaż dane")}</summary><div class="table-wrap"><table class="reports-table"><thead><tr><th>${escapeHtml(messages["reports.periodComparison.date"] ?? "Data")}</th><th>${escapeHtml(messages["reports.periodComparison.amount"] ?? "Kwota")}</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

async function init() {
    const [messageResponse, settingsResponse] = await Promise.all([fetch(`/api/reports/messages?lang=${language}`), fetch("/api/users/me/settings")]);
    messages = await messageResponse.json(); settings = await settingsResponse.json();
    const response = await fetch("/api/reports/period-comparison");
    if (!response.ok) throw new Error(messages["reports.error.load"] ?? "Nie udało się wczytać raportu.");
    render((await response.json()).periods ?? []);
}
rebuildCacheButton?.addEventListener("click", async () => {
    rebuildCacheButton.disabled = true;
    try {
        const response = await fetch("/api/reports/period-comparison/cache/rebuild", {method: "POST", cache: "no-store"});
        if (!response.ok) throw new Error(messages["reports.periodComparison.rebuildError"] ?? "Nie udało się odbudować danych.");
        await init();
    } catch (error) {
        periodComparisonList.innerHTML = `<p class="form-message" data-type="error">${escapeHtml(error.message)}</p>`;
    } finally {
        rebuildCacheButton.disabled = false;
    }
});
MoneySnapshotI18n.init({
    endpoint: "/api/reports/messages",
    onLanguageChange: ({language: nextLanguage, messages: nextMessages}) => {
        language = nextLanguage;
        messages = nextMessages;
        if (loadedPeriods.length) {
            render(loadedPeriods);
        }
    }
}).then(init).catch(error => { periodComparisonList.innerHTML = `<p class="form-message" data-type="error">${escapeHtml(error.message)}</p>`; });
