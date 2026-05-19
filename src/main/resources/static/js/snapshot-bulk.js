const bulkSnapshotForm = document.querySelector("#bulk-snapshot-form");
const noteInput = document.querySelector("#bulk-snapshot-note");
const tableBody = document.querySelector("#bulk-snapshot-table-body");
const formMessage = document.querySelector("#bulk-snapshot-message");
const BULK_SNAPSHOT_SUCCESS_KEY = "money-snapshot-bulk-snapshot-success-count";

let messages = {};
let accounts = [];
let snapshots = [];
let userSettings = null;
let snapshotDateInput = null;
let snapshotsLoaded = false;

function handleLanguageChange(nextMessages) {
    messages = nextMessages;
    document.title = `${messages["snapshots.bulk.title"]} | ${messages["app.name"]}`;
    renderAccounts();
}

function setFormMessage(text, type = "") {
    formMessage.textContent = text;
    formMessage.dataset.type = type;
}

function formatAccountName(account) {
    return account.accountName || "-";
}

function formatAccountMeta(account) {
    return [account.bankName, account.currencyCode].filter(Boolean).join(" · ") || "-";
}

function compareText(left, right) {
    return (left || "").localeCompare(right || "", undefined, {sensitivity: "base"});
}

function sortAccountsForDisplay(left, right) {
    return compareText(left.bankName, right.bankName)
            || compareText(left.accountName, right.accountName)
            || compareText(left.currencyCode, right.currencyCode);
}

function formatDate(value) {
    return MoneySnapshotUi.formatDateValue(value, userSettings);
}

function formatBalance(snapshot) {
    return MoneySnapshotUi.formatMoneyValue(snapshot.balance, userSettings);
}

function lastSnapshotForAccount(accountId) {
    return snapshots
            .filter((snapshot) => snapshot.accountId === accountId)
            .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))[0] ?? null;
}

function formatLastSnapshot(account) {
    if (!snapshotsLoaded) {
        return "-";
    }

    const lastSnapshot = lastSnapshotForAccount(account.id);
    if (!lastSnapshot) {
        return messages["snapshots.bulk.noLastBalance"] ?? "-";
    }

    return `${formatDate(lastSnapshot.snapshotDate)} · ${formatBalance(lastSnapshot)}`;
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function labelCell(key, fallback) {
    const cell = document.createElement("th");
    cell.scope = "row";
    cell.className = "bulk-row-heading";
    cell.textContent = messages[key] ?? fallback;
    return cell;
}

function accountHeaderCell(account) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.dataset.accountId = account.id;
    const name = document.createElement("span");
    const meta = document.createElement("span");
    name.className = "bulk-account-name";
    name.textContent = formatAccountName(account);
    meta.className = "bulk-account-meta";
    meta.textContent = formatAccountMeta(account);
    cell.append(name, meta);
    return cell;
}

function dateCell() {
    const cell = document.createElement("th");
    const label = document.createElement("span");
    const input = document.createElement("input");
    const previousDate = snapshotDateInput?.value || new Date().toISOString().slice(0, 10);

    cell.scope = "row";
    cell.className = "bulk-row-heading bulk-date-cell bulk-value-cell";
    label.textContent = messages["snapshots.form.date"] ?? "Data migawki";
    input.id = "bulk-snapshot-date";
    input.name = "snapshotDate";
    input.type = "date";
    input.required = true;
    input.value = previousDate;
    input.className = "table-input";
    cell.append(label, input);
    snapshotDateInput = input;

    return cell;
}

function renderAccounts() {
    if (accounts.length === 0) {
        renderEmpty(messages["snapshots.bulk.empty"] ?? "");
        return;
    }

    const previousAccounts = new Map(accounts.map((account) => {
        const balance = tableBody.querySelector(`[data-role='balance'][data-account-id='${account.id}']`);
        return [
            account.id,
            {
                balance: balance?.value ?? ""
            }
        ];
    }));

    const accountRow = document.createElement("tr");
    accountRow.append(labelCell("snapshots.table.account", "Konto"), ...accounts.map(accountHeaderCell));

    const balanceRow = document.createElement("tr");
    balanceRow.append(
            dateCell(),
            ...accounts.map((account) => {
                const previousAccount = previousAccounts.get(account.id);
                const cell = document.createElement("td");
                const spacer = document.createElement("span");
                const balanceInput = document.createElement("input");
                const lastBalance = document.createElement("span");
                cell.className = "bulk-balance-cell bulk-value-cell";
                spacer.className = "bulk-balance-spacer";
                spacer.setAttribute("aria-hidden", "true");
                spacer.textContent = messages["snapshots.form.date"] ?? "Data migawki";
                balanceInput.className = "table-input";
                balanceInput.type = "number";
                balanceInput.step = "0.0001";
                balanceInput.dataset.role = "balance";
                balanceInput.dataset.accountId = account.id;
                balanceInput.inputMode = "decimal";
                balanceInput.value = previousAccount?.balance ?? "";
                balanceInput.setAttribute("aria-label", `${messages["snapshots.table.balance"] ?? ""}: ${formatAccountName(account)}`);
                lastBalance.className = "bulk-last-balance";
                lastBalance.textContent = formatLastSnapshot(account);
                cell.append(spacer, balanceInput, lastBalance);
                return cell;
            })
    );

    tableBody.replaceChildren(accountRow, balanceRow);
}

function payloads() {
    return accounts.map((account) => ({
        account,
        payload: {
            accountId: account.id,
            snapshotDate: snapshotDateInput.value,
            balance: tableBody.querySelector(`[data-role='balance'][data-account-id='${account.id}']`).value,
            note: noteInput.value.trim()
        }
    }));
}

function validateAccountPayload({payload}) {
    if (!payload.snapshotDate) {
        return messages["snapshots.bulk.requiredDate"];
    }
    if (!payload.balance) {
        return messages["snapshots.bulk.requiredBalance"];
    }
    return "";
}

async function saveSnapshot(payload) {
    const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (response.status === 404) {
        throw new Error(messages["snapshots.error.accountNotFound"]);
    }

    if (response.status === 409) {
        throw new Error(messages["snapshots.error.duplicate"]);
    }

    if (!response.ok) {
        throw new Error(messages["snapshots.error.create"]);
    }

    return response.json();
}

async function loadAccounts() {
    const response = await fetch("/api/accounts");
    if (!response.ok) {
        throw new Error(messages["snapshots.error.loadAccounts"]);
    }

    accounts = [...await response.json()].sort(sortAccountsForDisplay);
    renderAccounts();
}

async function loadSnapshots() {
    const response = await fetch("/api/snapshots");
    if (!response.ok) {
        throw new Error(messages["snapshots.error.load"]);
    }

    snapshots = await response.json();
    snapshotsLoaded = true;
    renderAccounts();
}

bulkSnapshotForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const entries = payloads();
    if (entries.length === 0) {
        setFormMessage(messages["snapshots.bulk.empty"], "error");
        return;
    }

    const invalidEntries = entries
            .map((entry) => ({...entry, message: validateAccountPayload(entry)}))
            .filter((entry) => entry.message);

    if (invalidEntries.length > 0) {
        setFormMessage(messages["snapshots.bulk.validationError"], "error");
        return;
    }

    const submitButton = bulkSnapshotForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setFormMessage("");

    let savedCount = 0;
    let failedCount = 0;

    for (const {account, payload} of entries) {
        try {
            await saveSnapshot(payload);
            savedCount += 1;
        } catch (error) {
            console.error(`Cannot save snapshot for account ${account.id}`, error);
            failedCount += 1;
        }
    }

    if (failedCount > 0) {
        setFormMessage(messages["snapshots.bulk.partialSuccess"]
                .replace("{saved}", savedCount)
                .replace("{failed}", failedCount), "error");
    } else {
        window.sessionStorage.setItem(BULK_SNAPSHOT_SUCCESS_KEY, String(savedCount));
        window.location.href = "/snapshots.html";
        return;
    }

    submitButton.disabled = false;
});

MoneySnapshotI18n.init({
    endpoint: "/api/snapshots/messages",
    onLanguageChange: ({messages}) => {
        handleLanguageChange(messages);
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadAccounts)
        .then(loadSnapshots)
        .catch((error) => {
            renderEmpty(error.message);
            setFormMessage(error.message, "error");
        });
