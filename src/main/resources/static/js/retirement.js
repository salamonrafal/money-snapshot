const addButton = document.querySelector("#add-retirement-account");
const refreshButton = document.querySelector("#refresh-retirement");
const form = document.querySelector("#retirement-account-form");
const accountFormTitle = document.querySelector("#retirement-account-form-modal-title");
const accountFormSubtitle = document.querySelector("#retirement-account-form-modal .snapshot-form-modal-copy p:last-child");
const accountFormSubmitButton = document.querySelector("button[form='retirement-account-form'][type='submit']");
const contributionForm = document.querySelector("#retirement-contribution-form");
const contributionFormSubmitButton = document.querySelector("button[form='retirement-contribution-form'][type='submit']");
const contributionFormSubtitle = document.querySelector("#retirement-contribution-form-subtitle");
const contributionPreviousBalance = document.querySelector("#retirement-contribution-previous-balance");
const contributionCalculatedAmount = document.querySelector("#retirement-contribution-calculated-amount");
const totalBalanceElement = document.querySelector("#retirement-total-balance");
const monthlyContributionElement = document.querySelector("#retirement-monthly-contribution");
const accountCountElement = document.querySelector("#retirement-account-count");
const updatedAtElement = document.querySelector("#retirement-updated-at");
const tableBody = document.querySelector("#retirement-table-body");
const accountFormModal = MoneySnapshotUi.createModal({
    modalSelector: "#retirement-account-form-modal",
    closeSelectors: ["#retirement-account-form-modal [data-retirement-account-form-modal-close]"]
});
const contributionFormModal = MoneySnapshotUi.createModal({
    modalSelector: "#retirement-contribution-form-modal",
    closeSelectors: ["#retirement-contribution-form-modal [data-retirement-contribution-form-modal-close]"]
});
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-retirement-account-modal",
    subjectSelector: "#delete-retirement-account-subject",
    confirmSelector: "#confirm-delete-retirement-account",
    cancelSelector: "#cancel-delete-retirement-account"
});
const toastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});

let messages = {};
let userSettings = {
    dateTimeFormat: "Y-m-d H:m",
    moneyFormat: "### ###,00 zł"
};
let retirementAccounts = [];
let editingAccountId = null;
let contributionAccountId = null;

function parseAmount(value) {
    if (!value) {
        return 0;
    }

    const normalized = String(value)
            .replace(/\s/g, "")
            .replace(",", ".");
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : Number.NaN;
}

function setAmountValidity(input, amount) {
    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    input.setCustomValidity(Number.isNaN(amount) || amount < 0
            ? translated("retirement.form.invalidAmount")
            : "");
}

function calculateContributionAmount(currentBalance, account) {
    if (!account || Number.isNaN(currentBalance)) {
        return Number.NaN;
    }

    return currentBalance - Number(account.balance);
}

function setContributionBalanceValidity(input, currentBalance) {
    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    input.setCustomValidity(Number.isNaN(currentBalance) || currentBalance < 0
            ? translated("retirement.contributionForm.invalidAmount")
            : "");
}

function setContributionDateValidity(input, account) {
    if (!(input instanceof HTMLInputElement) || !account) {
        return;
    }

    input.setCustomValidity(input.value && input.value < account.balanceUpdatedAt
            ? translated("retirement.contributionForm.invalidDate")
            : "");
}

function renderContributionCalculation(account, currentBalance) {
    if (!contributionCalculatedAmount) {
        return;
    }

    const contributionAmount = calculateContributionAmount(currentBalance, account);
    contributionCalculatedAmount.textContent = Number.isNaN(contributionAmount)
            ? "-"
            : formatMoneyWithCurrency(contributionAmount, account.currencyCode);
    contributionCalculatedAmount.dataset.type = contributionAmount > 0 ? "success" : "error";
}

function syncContributionNoteAvailability(account, currentBalance) {
    const noteInput = contributionForm?.elements.note;
    if (!(noteInput instanceof HTMLInputElement)) {
        return;
    }

    const contributionAmount = calculateContributionAmount(currentBalance, account);
    const canSaveNote = !Number.isNaN(contributionAmount) && contributionAmount > 0;
    noteInput.disabled = !canSaveNote;
    if (!canSaveNote) {
        noteInput.value = "";
    }
}

function formatMoney(value) {
    return MoneySnapshotUi.formatMoneyValue(value, userSettings);
}

function moneyFormatSuffix() {
    const mask = userSettings.moneyFormat || "### ###,00 zł";
    return mask.replace(/[#,.\s0]+/g, "").trim();
}

function formatMoneyNumber(value) {
    const formatted = formatMoney(value);
    const suffix = moneyFormatSuffix();
    return suffix && formatted.endsWith(` ${suffix}`)
            ? formatted.slice(0, -suffix.length - 1)
            : formatted;
}

function formatMoneyWithCurrency(value, currencyCode) {
    const code = currencyCode ? String(currencyCode).toUpperCase() : "";
    return code ? `${formatMoneyNumber(value)} ${code}` : formatMoney(value);
}

function formatDate(value) {
    return value ? MoneySnapshotUi.formatDateValue(value, userSettings) : "-";
}

function translated(key) {
    return messages[key] ?? key;
}

function accountTypeLabel(accountTypeCode) {
    return translated(`retirement.type.${accountTypeCode}`);
}

function showToast(text, type = "") {
    if (!text) {
        toastManager.clear();
        return;
    }

    toastManager.clear();
    toastManager.show(text, {type});
}

function accountSubject(account) {
    return `${accountTypeLabel(account.accountTypeCode)} - ${account.accountName}`;
}

function findAccount(accountId) {
    return retirementAccounts.find((account) => account.id === accountId) ?? null;
}

function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) {
        cell.className = className;
    }
    return cell;
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = createCell(message);
    cell.colSpan = 8;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function setAccountFormMode(mode) {
    const isEdit = mode === "edit";
    if (accountFormTitle) {
        accountFormTitle.textContent = translated(isEdit ? "retirement.form.editTitle" : "retirement.form.title");
    }
    if (accountFormSubtitle) {
        accountFormSubtitle.textContent = translated(isEdit ? "retirement.form.editSubtitle" : "retirement.form.subtitle");
    }
    if (accountFormSubmitButton) {
        accountFormSubmitButton.textContent = translated(isEdit ? "retirement.form.update" : "retirement.form.submit");
    }
    if (form?.elements.currency) {
        form.elements.currency.disabled = isEdit;
    }
    if (form?.elements.balance) {
        form.elements.balance.disabled = isEdit;
    }
    if (form?.elements.updatedAt) {
        form.elements.updatedAt.disabled = isEdit;
    }
}

function fillAccountForm(account) {
    form.elements.type.value = account.accountTypeCode;
    form.elements.institution.value = account.institution;
    form.elements.account.value = account.accountName;
    form.elements.websiteUrl.value = account.websiteUrl ?? "";
    form.elements.currency.value = account.currencyCode ?? "PLN";
    form.elements.balance.value = String(account.balance).replace(".", ",");
    form.elements.monthlyContribution.value = Number(account.monthlyContribution) > 0
            ? String(account.monthlyContribution).replace(".", ",")
            : "";
    form.elements.updatedAt.value = account.balanceUpdatedAt;
    form.elements.statusKey.value = account.status;
    [form.elements.type, form.elements.statusKey].forEach((select) => {
        window.MoneySnapshotSelect?.create(select)?.refresh();
    });
}

function amountsByCurrency(accounts, selector) {
    return accounts.reduce((totals, account) => {
        const currencyCode = account.currencyCode ?? "PLN";
        totals.set(currencyCode, (totals.get(currencyCode) ?? 0) + Number(selector(account)));
        return totals;
    }, new Map());
}

function formatCurrencyTotals(totals) {
    if (totals.size === 0) {
        return formatMoney(0);
    }

    return [...totals.entries()]
            .sort(([leftCurrency], [rightCurrency]) => leftCurrency.localeCompare(rightCurrency))
            .map(([currencyCode, amount]) => formatMoneyWithCurrency(amount, currencyCode))
            .join(" / ");
}

function renderSummary() {
    const total = amountsByCurrency(retirementAccounts, (account) => account.balance);
    const monthly = amountsByCurrency(retirementAccounts, (account) => account.monthlyContribution);
    const latestUpdatedAt = retirementAccounts
            .map((account) => account.balanceUpdatedAt)
            .sort()
            .at(-1);

    totalBalanceElement.textContent = formatCurrencyTotals(total);
    monthlyContributionElement.textContent = formatCurrencyTotals(monthly);
    accountCountElement.textContent = String(retirementAccounts.length);
    updatedAtElement.textContent = formatDate(latestUpdatedAt);
}

function createIconButton(action, labelKey, iconPaths, className = "secondary") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-button ${className} retirement-row-action`;
    button.dataset.retirementAction = action;
    const label = translated(labelKey);
    button.setAttribute("aria-label", label);
    MoneySnapshotUi.setTooltip(button, label);

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");

    iconPaths.forEach((pathValue) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathValue);
        icon.append(path);
    });

    button.append(icon);
    return button;
}

function createEditLink(account, iconPaths) {
    const link = createIconButton("edit", "retirement.actions.edit", iconPaths);
    const anchor = document.createElement("a");
    [...link.attributes].forEach((attribute) => anchor.setAttribute(attribute.name, attribute.value));
    anchor.href = `/retirement/accounts/${encodeURIComponent(account.id)}/edit.html`;
    anchor.innerHTML = link.innerHTML;
    anchor.dataset.retirementAction = "edit";
    return anchor;
}

function createContributionLink(account, iconPaths) {
    const link = createIconButton("contribution", "retirement.actions.registerContribution", iconPaths);
    const anchor = document.createElement("a");
    [...link.attributes].forEach((attribute) => anchor.setAttribute(attribute.name, attribute.value));
    anchor.href = `/retirement/accounts/${encodeURIComponent(account.id)}/balance/new.html`;
    anchor.innerHTML = link.innerHTML;
    anchor.dataset.retirementAction = "contribution";
    return anchor;
}

function createIconLink(href, labelKey, iconPaths) {
    const link = document.createElement("a");
    link.className = "icon-button secondary retirement-row-action";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const label = translated(labelKey);
    link.setAttribute("aria-label", label);
    MoneySnapshotUi.setTooltip(link, label);

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");

    iconPaths.forEach((pathValue) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathValue);
        icon.append(path);
    });

    link.append(icon);
    return link;
}

function createRowActions(account) {
    const actions = document.createElement("div");
    actions.className = "row-actions retirement-row-actions";
    actions.dataset.accountId = String(account.id);
    const actionButtons = [
            createEditLink(account, [
                "M12 20h9",
                "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
            ]),
            createContributionLink(account, [
                "M12 5v14",
                "M5 12h14",
                "M4 19h16"
            ]),
            createIconButton("delete", "retirement.actions.delete", [
                "M3 6h18",
                "M8 6V4h8v2",
                "M19 6l-1 14H6L5 6",
                "M10 11v6",
                "M14 11v6"
            ], "danger")
    ];
    if (account.websiteUrl) {
        actionButtons.splice(2, 0, createIconLink(account.websiteUrl, "retirement.actions.goTo", [
            "M7 17 17 7",
            "M8 7h9v9",
            "M5 12v7h7"
        ]));
    }
    actions.append(...actionButtons);
    return actions;
}

function renderTable() {
    if (retirementAccounts.length === 0) {
        renderEmpty(translated("retirement.empty"));
        return;
    }

    tableBody.replaceChildren(...retirementAccounts.map((account) => {
        const row = document.createElement("tr");
        const status = document.createElement("span");
        status.className = "retirement-status";
        status.textContent = translated(`retirement.status.${account.status}`);

        const statusCell = document.createElement("td");
        statusCell.append(status);
        const actionsCell = document.createElement("td");
        actionsCell.className = "retirement-actions-cell";
        actionsCell.append(createRowActions(account));

        row.append(
                createCell(accountTypeLabel(account.accountTypeCode), "retirement-type-cell"),
                createCell(account.institution),
                createCell(account.accountName),
                createCell(formatMoneyWithCurrency(Number(account.balance), account.currencyCode), "retirement-money-cell"),
                createCell(Number(account.monthlyContribution) > 0 ? formatMoneyWithCurrency(Number(account.monthlyContribution), account.currencyCode) : "-", "retirement-money-cell"),
                createCell(formatDate(account.balanceUpdatedAt)),
                statusCell,
                actionsCell
        );
        return row;
    }));
}

function renderRetirementView() {
    renderSummary();
    renderTable();
}

function openAddForm() {
    editingAccountId = null;
    if (form) {
        form.reset();
        form.elements.currency.value = userSettings.defaultCurrency ?? "PLN";
        form.elements.updatedAt.value = MoneySnapshotUi.localIsoDate();
        [form.elements.type, form.elements.statusKey].forEach((select) => {
            window.MoneySnapshotSelect?.create(select)?.refresh();
        });
        form.querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
    }
    setAccountFormMode("add");
    accountFormModal.open({trigger: addButton});
}

function openEditForm(accountId, trigger) {
    const account = findAccount(accountId);
    if (!account || !form) {
        return;
    }

    editingAccountId = accountId;
    fillAccountForm(account);
    form.querySelectorAll("input").forEach((input) => input.setCustomValidity(""));
    setAccountFormMode("edit");
    accountFormModal.open({trigger});
}

function openContributionForm(accountId, trigger) {
    const account = findAccount(accountId);
    if (!account || !contributionForm) {
        return;
    }

    contributionAccountId = accountId;
    contributionForm.reset();
    contributionForm.elements.contributionDate.min = account.balanceUpdatedAt;
    const defaultDate = MoneySnapshotUi.localIsoDate();
    contributionForm.elements.contributionDate.value = defaultDate < account.balanceUpdatedAt
            ? account.balanceUpdatedAt
            : defaultDate;
    contributionForm.elements.currentBalance.setCustomValidity("");
    contributionForm.elements.contributionDate.setCustomValidity("");
    if (contributionPreviousBalance) {
        contributionPreviousBalance.textContent = formatMoneyWithCurrency(Number(account.balance), account.currencyCode);
    }
    renderContributionCalculation(account, Number.NaN);
    syncContributionNoteAvailability(account, Number.NaN);
    if (contributionFormSubtitle) {
        contributionFormSubtitle.textContent = `${translated("retirement.contributionForm.subtitle")} ${accountSubject(account)}`;
    }
    contributionFormModal.open({trigger});
}

function openDeleteModal(accountId) {
    const account = findAccount(accountId);
    if (!account) {
        return;
    }

    deleteModal.open(account, accountSubject(account));
}

async function parseError(response, fallbackKey) {
    if (response.status === 404) {
        return translated("retirement.error.notFound");
    }

    if (response.status === 409) {
        return translated("retirement.error.duplicate");
    }

    try {
        const body = await response.json();
        if (body?.message) {
            if (body.message.includes("Website URL")) {
                return translated("retirement.error.invalidWebsiteUrl");
            }
            if (body.message.includes("Current balance")) {
                return translated("retirement.contributionForm.invalidAmount");
            }
            if (body.message.includes("Balance update date")) {
                return translated("retirement.contributionForm.invalidDate");
            }
            return body.message;
        }
    } catch {
    }

    return translated(fallbackKey);
}

async function loadAccounts() {
    const response = await fetch("/api/retirement-accounts");
    if (!response.ok) {
        throw new Error(await parseError(response, "retirement.error.load"));
    }

    retirementAccounts = await response.json();
    renderRetirementView();
}

async function saveAccount(accountData) {
    const isEdit = editingAccountId !== null;
    const response = await fetch(isEdit
            ? `/api/retirement-accounts/${encodeURIComponent(editingAccountId)}`
            : "/api/retirement-accounts", {
        method: isEdit ? "PUT" : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(accountData)
    });

    if (!response.ok) {
        throw new Error(await parseError(response, isEdit ? "retirement.error.update" : "retirement.error.create"));
    }
}

async function registerAccountContribution(accountId, currentBalance, contributionDate, note) {
    const response = await fetch(`/api/retirement-accounts/${encodeURIComponent(accountId)}/contributions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({currentBalance, contributionDate, note})
    });

    if (!response.ok) {
        throw new Error(await parseError(response, "retirement.error.registerContribution"));
    }
}

async function updateAccountBalance(accountId, balance, balanceUpdatedAt) {
    const response = await fetch(`/api/retirement-accounts/${encodeURIComponent(accountId)}/balance`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({balance, balanceUpdatedAt})
    });

    if (!response.ok) {
        throw new Error(await parseError(response, "retirement.error.updateBalance"));
    }
}

async function deleteAccount(accountId) {
    const response = await fetch(`/api/retirement-accounts/${encodeURIComponent(accountId)}`, {
        method: "DELETE"
    });

    if (!response.ok) {
        throw new Error(await parseError(response, "retirement.error.delete"));
    }
}

refreshButton?.addEventListener("click", () => {
    showToast("");
    loadAccounts().catch((error) => {
        showToast(error.message, "error");
        renderEmpty(error.message);
    });
});

addButton?.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }
    event.preventDefault();
    openAddForm();
});

form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const balance = parseAmount(form.elements.balance.value);
    const monthlyContribution = parseAmount(form.elements.monthlyContribution.value);
    const currencyCode = form.elements.currency.value.trim().toUpperCase();
    setAmountValidity(form.elements.balance, balance);
    setAmountValidity(form.elements.monthlyContribution, monthlyContribution);
    form.elements.currency.setCustomValidity(/^[A-Z]{3}$/.test(currencyCode)
            ? ""
            : translated("retirement.form.invalidCurrency"));
    const isInvalid = !form.checkValidity()
            || Number.isNaN(balance)
            || balance < 0
            || Number.isNaN(monthlyContribution)
            || monthlyContribution < 0;

    if (isInvalid) {
        showToast(form.elements.currency.validationMessage || translated("retirement.form.invalidAmount"), "error");
        form.reportValidity();
        return;
    }

    const wasEditing = editingAccountId !== null;
    const accountData = {
        accountTypeCode: form.elements.type.value,
        institution: form.elements.institution.value.trim(),
        accountName: form.elements.account.value.trim(),
        websiteUrl: form.elements.websiteUrl.value.trim(),
        currencyCode,
        balance,
        monthlyContribution,
        balanceUpdatedAt: form.elements.updatedAt.value,
        status: form.elements.statusKey.value
    };

    if (accountFormSubmitButton) {
        accountFormSubmitButton.disabled = true;
    }
    saveAccount(accountData)
            .then(() => {
                editingAccountId = null;
                accountFormModal.close();
                showToast(translated(wasEditing ? "retirement.form.updateSuccess" : "retirement.form.success"), "success");
                return loadAccounts();
            })
            .catch((error) => {
                showToast(error.message, "error");
            })
            .finally(() => {
                if (accountFormSubmitButton) {
                    accountFormSubmitButton.disabled = false;
                }
            });
});

contributionForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const account = findAccount(contributionAccountId);
    const currentBalance = parseAmount(contributionForm.elements.currentBalance.value);
    const contributionAmount = calculateContributionAmount(currentBalance, account);
    setContributionBalanceValidity(contributionForm.elements.currentBalance, currentBalance);
    setContributionDateValidity(contributionForm.elements.contributionDate, account);
    renderContributionCalculation(account, currentBalance);
    syncContributionNoteAvailability(account, currentBalance);

    if (!account) {
        showToast(translated("retirement.error.notFound"), "error");
        return;
    }

    if (!contributionForm.checkValidity() || Number.isNaN(currentBalance) || currentBalance < 0) {
        showToast(
                contributionForm.elements.contributionDate.validationMessage
                        || contributionForm.elements.currentBalance.validationMessage
                        || translated("retirement.contributionForm.invalidAmount"),
                "error"
        );
        contributionForm.reportValidity();
        return;
    }

    if (contributionFormSubmitButton) {
        contributionFormSubmitButton.disabled = true;
    }
    const balanceUpdatedAt = contributionForm.elements.contributionDate.value;
    const balanceSave = contributionAmount > 0
            ? registerAccountContribution(
                    contributionAccountId,
                    currentBalance,
                    balanceUpdatedAt,
                    contributionForm.elements.note.value.trim()
            )
            : updateAccountBalance(contributionAccountId, currentBalance, balanceUpdatedAt);
    balanceSave
            .then(() => {
                contributionAccountId = null;
                contributionFormModal.close();
                showToast(translated(contributionAmount > 0
                        ? "retirement.contributionForm.success"
                        : "retirement.contributionForm.balanceUpdateSuccess"), "success");
                return loadAccounts();
            })
            .catch((error) => {
                showToast(error.message, "error");
            })
            .finally(() => {
                if (contributionFormSubmitButton) {
                    contributionFormSubmitButton.disabled = false;
                }
            });
});

tableBody?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
        return;
    }

    const button = event.target.closest("[data-retirement-action]");
    if (!(button instanceof HTMLElement)) {
        return;
    }

    const accountId = button.closest("[data-account-id]")?.dataset.accountId;
    if (!accountId) {
        return;
    }

    if (button.dataset.retirementAction === "edit") {
        if (button instanceof HTMLAnchorElement
                && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) {
            return;
        }
        event.preventDefault();
        openEditForm(accountId, button);
    } else if (button.dataset.retirementAction === "contribution") {
        if (button instanceof HTMLAnchorElement
                && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) {
            return;
        }
        event.preventDefault();
        openContributionForm(accountId, button);
    } else if (button.dataset.retirementAction === "delete") {
        openDeleteModal(accountId);
    }
});

deleteModal.confirmButton?.addEventListener("click", () => {
    const selectedAccount = deleteModal.getSelectedItem();
    if (!selectedAccount) {
        return;
    }

    deleteModal.confirmButton.disabled = true;
    showToast("");
    deleteAccount(selectedAccount.id)
            .then(() => {
                deleteModal.close();
                showToast(translated("retirement.delete.success"), "success");
                return loadAccounts();
            })
            .catch((error) => {
                deleteModal.close();
                showToast(error.message, "error");
            })
            .finally(() => {
                deleteModal.confirmButton.disabled = false;
            });
});

document.querySelectorAll("#retirement-account-form input[name='balance'], #retirement-account-form input[name='monthlyContribution'], #retirement-contribution-form input[name='currentBalance']").forEach((input) => {
    input.addEventListener("input", () => {
        input.setCustomValidity("");
    });
});

contributionForm?.elements.currentBalance?.addEventListener("input", () => {
    const currentBalance = parseAmount(contributionForm.elements.currentBalance.value);
    setContributionBalanceValidity(contributionForm.elements.currentBalance, currentBalance);
    renderContributionCalculation(findAccount(contributionAccountId), currentBalance);
    syncContributionNoteAvailability(findAccount(contributionAccountId), currentBalance);
});

contributionForm?.elements.contributionDate?.addEventListener("input", () => {
    setContributionDateValidity(contributionForm.elements.contributionDate, findAccount(contributionAccountId));
});

MoneySnapshotI18n.init({
    endpoint: "/api/retirement/messages",
    onLanguageChange: ({messages: loadedMessages}) => {
        messages = loadedMessages;
        document.title = `${translated("retirement.heading.title")} | ${translated("app.name")}`;
        renderRetirementView();
    }
})
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadAccounts)
        .catch((error) => {
            showToast(error.message, "error");
            renderEmpty(error.message);
        });
