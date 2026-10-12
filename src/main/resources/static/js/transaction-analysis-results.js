const resultsBody = document.querySelector("#transaction-analyzer-results-body");
const resultsEmpty = document.querySelector("#transaction-analyzer-results-empty");
const resultsTable = document.querySelector("#transaction-analyzer-results-table-wrap");
const details = document.querySelector("#transaction-analyzer-details");
let messages = {};
let currentAnalysis = null;
let userSettings = null;

function formatAmount(value) {
    const moneyFormat = (userSettings?.moneyFormat ?? "### ###,00").replace(/[^#,.\s0]/g, "").trim();
    return MoneySnapshotUi.formatMoneyValue(value, {...userSettings, moneyFormat});
}

function renderResults(analysis) {
    currentAnalysis = analysis;
    const metadata = [
        ["transactionAnalyzer.results.dateRange", "Zakres dat", analysis.dateRange],
        ["transactionAnalyzer.results.accountNumber", "Nr rachunku", analysis.accountNumber],
        ["transactionAnalyzer.results.accountName", "Nazwa rachunku", analysis.accountName]
    ].filter(([, , value]) => value);
    details.replaceChildren(...metadata.map(([key, fallback, value]) => {
        const item = document.createElement("div");
        const label = document.createElement("dt");
        label.textContent = messages[key] ?? fallback;
        const content = document.createElement("dd");
        content.textContent = value;
        item.append(label, content);
        return item;
    }));
    details.hidden = metadata.length === 0;
    resultsBody.replaceChildren(...analysis.recurringTransactions.map((transaction, index, transactions) => {
        const row = document.createElement("tr");
        row.className = "transaction-analysis-result-row" + (index === transactions.length - 1 ? " is-last" : "");
        const countCell = document.createElement("td");
        countCell.className = "transaction-analysis-operation-count";
        const detailsButton = document.createElement("button");
        detailsButton.type = "button";
        detailsButton.className = "icon-button secondary compact transaction-analysis-details-button";
        detailsButton.textContent = "+";
        detailsButton.setAttribute("aria-label", "Pokaż daty operacji");
        const count = document.createElement("span");
        count.textContent = String(transaction.transactionDates.length);
        countCell.append(detailsButton, count);
        row.append(countCell);
        [transaction.title, transaction.counterparty, formatAmount(transaction.amount), transaction.currency].forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            if (index === 2) {
                cell.className = "numeric-cell";
            }
            row.append(cell);
        });

        const datesRow = document.createElement("tr");
        datesRow.className = "transaction-analysis-dates-row" + (index === transactions.length - 1 ? " is-last" : "");
        datesRow.hidden = true;
        const datesCell = document.createElement("td");
        datesCell.colSpan = 5;
        datesCell.className = "transaction-analysis-dates-cell";
        const datesTitle = document.createElement("strong");
        datesTitle.textContent = messages["transactionAnalyzer.results.dates"] ?? "Daty operacji";
        datesCell.append(datesTitle, document.createElement("br"), transaction.transactionDates.join(", "));
        datesRow.append(datesCell);
        detailsButton.addEventListener("click", () => {
            const expanded = datesRow.hidden;
            datesRow.hidden = !expanded;
            row.classList.toggle("is-expanded", expanded);
            detailsButton.textContent = expanded ? "−" : "+";
            detailsButton.setAttribute("aria-label", expanded ? "Ukryj daty operacji" : "Pokaż daty operacji");
        });
        return [row, datesRow];
    }).flat());
    resultsEmpty.hidden = analysis.recurringTransactions.length > 0;
    resultsTable.hidden = analysis.recurringTransactions.length === 0;
}

async function restoreAnalysis() {
    const storedAnalysis = sessionStorage.getItem("transaction-analyzer-result");
    if (!storedAnalysis) {
        resultsEmpty.hidden = false;
        resultsTable.hidden = true;
        return;
    }
    try {
        const cachedAnalysis = JSON.parse(storedAnalysis);
        if (!cachedAnalysis.ownerId || !cachedAnalysis.analysis) {
            sessionStorage.removeItem("transaction-analyzer-result");
            resultsEmpty.hidden = false;
            resultsTable.hidden = true;
            return;
        }
        const response = await fetch("/api/users/me");
        if (!response.ok) {
            throw new Error("Could not identify current user");
        }
        const user = await response.json();
        if (cachedAnalysis.ownerId !== user.id) {
            sessionStorage.removeItem("transaction-analyzer-result");
            resultsEmpty.hidden = false;
            resultsTable.hidden = true;
            return;
        }
        renderResults(cachedAnalysis.analysis);
    } catch (error) {
        console.error("Could not restore transaction analysis", error);
        resultsEmpty.hidden = false;
        resultsTable.hidden = true;
    }
}

MoneySnapshotI18n.init({
    endpoint: "/api/transaction-analyzer/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        messages = nextMessages;
        MoneySnapshotUi.loadUserSettings().then((settings) => {
            userSettings = settings;
            if (currentAnalysis) {
                renderResults(currentAnalysis);
            } else {
            restoreAnalysis().catch(console.error);
            }
        }).catch(console.error);
    }
}).catch(console.error);
