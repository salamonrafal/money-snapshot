const tableBody = document.querySelector("#savings-planning-settings-table-body");
const form = document.querySelector("#savings-planning-settings-form");
const formMessage = document.querySelector("#savings-planning-settings-message");

let messages = {};
let currentAccounts = [];
let accountsLoaded = false;

function setMessage(text, type = "") {
    formMessage.textContent = text;
    formMessage.dataset.type = type;
}

function contributionPlaceholder() {
    return document.documentElement.lang === "en" ? "0.00" : "0,00";
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

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function renderAccounts(accounts) {
    currentAccounts = accounts;
    accountsLoaded = true;

    if (accounts.length === 0) {
        renderEmpty(messages["savingsPlanningSettings.empty"]);
        return;
    }

    tableBody.replaceChildren(...accounts.map((account) => {
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

async function loadAccounts() {
    const response = await fetch("/api/accounts/savings-planning");
    if (!response.ok) {
        throw new Error(messages["savingsPlanningSettings.error.load"]);
    }

    renderAccounts(await response.json());
}

function collectPayload() {
    const inputs = tableBody.querySelectorAll("input[data-account-id]");
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

async function saveAccounts(payload) {
    const response = await fetch("/api/accounts/savings-planning", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(messages["savingsPlanningSettings.error.update"]);
    }

    renderAccounts(await response.json());
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = collectPayload();
    if (!payload) {
        setMessage(messages["savingsPlanningSettings.form.required"], "error");
        return;
    }

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setMessage("");

    try {
        await saveAccounts(payload);
        setMessage(messages["savingsPlanningSettings.form.success"], "success");
    } catch (error) {
        setMessage(error.message, "error");
    } finally {
        submitButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/savings-planning-settings/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        messages = nextMessages;
        document.title = `${messages["savingsPlanningSettings.heading.title"]} | ${messages["app.name"]}`;
        if (!accountsLoaded) {
            renderEmpty(messages["savingsPlanningSettings.loading"]);
            return;
        }
        renderAccounts(currentAccounts);
    }
})
        .then(loadAccounts)
        .catch((error) => {
            renderEmpty(error.message);
        });
