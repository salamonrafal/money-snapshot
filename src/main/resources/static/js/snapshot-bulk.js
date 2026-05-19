const bulkSnapshotForm = document.querySelector("#bulk-snapshot-form");
const noteInput = document.querySelector("#bulk-snapshot-note");
const tableBody = document.querySelector("#bulk-snapshot-table-body");
const formMessage = document.querySelector("#bulk-snapshot-message");

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

function formatAccountInputLabel(account) {
    return [formatAccountName(account), account.bankName, account.currencyCode].filter(Boolean).join(", ");
}

function validationErrorId(accountId) {
    return `bulk-snapshot-balance-error-${String(accountId).replace(/[^a-z0-9_-]/gi, "-")}`;
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
    const error = document.createElement("span");
    const previousDate = snapshotDateInput?.value || MoneySnapshotUi.localIsoDate();

    cell.scope = "row";
    cell.className = "bulk-row-heading bulk-date-cell bulk-value-cell";
    label.textContent = messages["snapshots.form.date"] ?? "Data migawki";
    input.id = "bulk-snapshot-date";
    input.name = "snapshotDate";
    input.type = "date";
    input.required = true;
    input.value = previousDate;
    input.className = "table-input";
    input.addEventListener("input", () => clearInputError(input, error));
    error.id = "bulk-snapshot-date-error";
    error.className = "bulk-input-error";
    error.dataset.role = "validation-error";
    error.setAttribute("aria-live", "polite");
    error.hidden = true;
    cell.append(label, input, error);
    snapshotDateInput = input;

    return cell;
}

function createBalanceInputCell(account, previousAccount, compact = false) {
    const cell = document.createElement("td");
    const spacer = document.createElement("span");
    const balanceInput = document.createElement("input");
    const error = document.createElement("span");
    const lastBalance = document.createElement("span");

    cell.className = `bulk-balance-cell bulk-value-cell${compact ? " bulk-compact-value-cell" : ""}`;
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
    balanceInput.setAttribute("aria-label", `${messages["snapshots.table.balance"] ?? ""}: ${formatAccountInputLabel(account)}`);
    balanceInput.addEventListener("input", () => clearInputError(balanceInput, error));
    error.id = validationErrorId(account.id);
    error.className = "bulk-input-error";
    error.dataset.role = "validation-error";
    error.setAttribute("aria-live", "polite");
    error.hidden = true;
    lastBalance.className = "bulk-last-balance";
    lastBalance.textContent = formatLastSnapshot(account);
    cell.append(spacer, balanceInput, error, lastBalance);
    return cell;
}

function isCompactBulkLayout() {
    return window.matchMedia("(max-width: 1024px)").matches;
}

function renderCompactAccounts(previousAccounts) {
    const dateRow = document.createElement("tr");
    const dateHeading = labelCell("snapshots.form.date", "Data migawki");
    const dateValueCell = document.createElement("td");
    const dateInputCell = dateCell();
    const dateInput = dateInputCell.querySelector("input");
    const dateError = dateInputCell.querySelector(".bulk-input-error");

    dateValueCell.className = "bulk-compact-date-cell";
    if (dateInput) {
        dateValueCell.append(dateInput);
    }
    if (dateError) {
        dateValueCell.append(dateError);
    }
    dateRow.append(dateHeading, dateValueCell);

    const accountRows = accounts.map((account) => {
        const row = document.createElement("tr");
        const heading = document.createElement("th");
        heading.scope = "row";
        heading.className = "bulk-row-heading bulk-compact-heading";
        const name = document.createElement("span");
        const meta = document.createElement("span");
        name.className = "bulk-account-name";
        name.textContent = formatAccountName(account);
        meta.className = "bulk-account-meta";
        meta.textContent = formatAccountMeta(account);
        heading.append(name, meta);
        row.append(heading, createBalanceInputCell(account, previousAccounts.get(account.id), true));
        return row;
    });

    tableBody.replaceChildren(dateRow, ...accountRows);
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

    const table = tableBody.closest(".bulk-snapshot-table");
    table?.classList.toggle("bulk-snapshot-table-compact", isCompactBulkLayout());

    if (isCompactBulkLayout()) {
        renderCompactAccounts(previousAccounts);
        return;
    }

    const accountRow = document.createElement("tr");
    accountRow.append(labelCell("snapshots.table.account", "Konto"), ...accounts.map(accountHeaderCell));

    const balanceRow = document.createElement("tr");
    balanceRow.append(
            dateCell(),
            ...accounts.map((account) => createBalanceInputCell(account, previousAccounts.get(account.id)))
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

function clearInputError(input, error) {
    input.removeAttribute("aria-invalid");
    if (input.getAttribute("aria-describedby") === error.id) {
        input.removeAttribute("aria-describedby");
    }
    error.textContent = "";
    error.hidden = true;
}

function clearValidationErrors() {
    bulkSnapshotForm.querySelectorAll("[data-role='validation-error']").forEach((error) => {
        error.textContent = "";
        error.hidden = true;
    });
    bulkSnapshotForm.querySelectorAll("[aria-invalid='true']").forEach((input) => {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
    });
}

function markInputError(input, error, message) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", error.id);
    error.textContent = message;
    error.hidden = false;
}

function balanceInputForAccount(accountId) {
    return tableBody.querySelector(`[data-role='balance'][data-account-id='${accountId}']`);
}

function markValidationErrors(invalidEntries) {
    const dateError = document.querySelector("#bulk-snapshot-date-error");
    let firstInvalidInput = null;

    if (!snapshotDateInput.value) {
        markInputError(snapshotDateInput, dateError, invalidEntries[0].message);
        firstInvalidInput = snapshotDateInput;
    }

    invalidEntries
            .filter(({payload}) => payload.snapshotDate && !payload.balance)
            .forEach(({account, message}) => {
                const input = balanceInputForAccount(account.id);
                const error = document.querySelector(`#${validationErrorId(account.id)}`);
                markInputError(input, error, message);
                if (!firstInvalidInput) {
                    firstInvalidInput = input;
                }
            });

    firstInvalidInput?.scrollIntoView({block: "center", inline: "center", behavior: "smooth"});
    firstInvalidInput?.focus({preventScroll: true});
}

async function saveSnapshots(entries) {
    const response = await fetch("/api/snapshots/bulk", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            snapshots: entries.map(({payload}) => payload)
        })
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

window.addEventListener("resize", () => {
    if (accounts.length > 0) {
        renderAccounts();
    }
});

bulkSnapshotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearValidationErrors();

    const entries = payloads();
    if (entries.length === 0) {
        setFormMessage(messages["snapshots.bulk.empty"], "error");
        return;
    }

    const invalidEntries = entries
            .map((entry) => ({...entry, message: validateAccountPayload(entry)}))
            .filter((entry) => entry.message);

    if (invalidEntries.length > 0) {
        markValidationErrors(invalidEntries);
        setFormMessage(messages["snapshots.bulk.validationError"], "error");
        return;
    }

    const submitButton = bulkSnapshotForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setFormMessage("");

    try {
        const savedSnapshots = await saveSnapshots(entries);
        window.sessionStorage.setItem(MoneySnapshotUi.bulkSnapshotSuccessKey, String(savedSnapshots.length));
        window.location.href = "/snapshots.html";
    } catch (error) {
        console.error("Cannot save bulk snapshots", error);
        setFormMessage(error.message, "error");
        submitButton.disabled = false;
    }
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
