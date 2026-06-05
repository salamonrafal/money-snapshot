window.MoneySnapshotBulkSnapshotForm = (() => {
    const MODAL_MAX_WIDTH = 1440;
    const MODAL_MIN_WIDTH = 760;
    const MODAL_SIDE_MARGIN = 48;
    const MODAL_BASE_WIDTH = 280;
    const MODAL_ACCOUNT_COLUMN_WIDTH = 148;

    function isCompactBulkLayout() {
        return window.matchMedia("(max-width: 1024px)").matches;
    }

    function createController(root, {
        messages = {},
        userSettings = null,
        redirectOnSuccess = true,
        onSuccess = null
    } = {}) {
        const bulkSnapshotForm = root;
        const modalRoot = bulkSnapshotForm.closest(".snapshot-bulk-modal");
        const noteInput = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-note']");
        const snapshotDateInput = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-date']");
        const snapshotTypeSelect = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-type']");
        const tableBody = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-table-body']");
        const messageContainer = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-message-container']");
        const formMessage = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-message']");
        const submitButton = bulkSnapshotForm.querySelector("button[type='submit']")
            ?? document.querySelector(`[form='${bulkSnapshotForm.id}'][type='submit']`);

        let currentMessages = messages;
        let accounts = [];
        let snapshots = [];
        let currentUserSettings = userSettings;
        let snapshotsLoaded = false;
        let draftSnapshotDate = "";
        const draftBalances = new Map();
        let compactBulkLayout = isCompactBulkLayout();
        let resizeDebounceTimer = null;
        let initializedPromise = null;
        let lastLoadPromise = null;

        function setFormMessage(text, type = "") {
            formMessage.textContent = text;
            formMessage.dataset.type = type;
            if (messageContainer) {
                messageContainer.dataset.type = type || "error";
                messageContainer.hidden = !text;
            }
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
            return MoneySnapshotUi.formatDateValue(value, currentUserSettings);
        }

        function formatBalance(snapshot) {
            return MoneySnapshotUi.formatMoneyValue(snapshot.balance, currentUserSettings);
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
                return currentMessages["snapshots.bulk.noLastBalance"] ?? "-";
            }

            return `${formatDate(lastSnapshot.snapshotDate)} · ${formatBalance(lastSnapshot)}`;
        }

        function renderEmpty(message) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.textContent = message;
            row.append(cell);
            tableBody.replaceChildren(row);
            syncModalWidth();
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

        function defaultSnapshotDate() {
            return draftSnapshotDate || MoneySnapshotUi.localIsoDate();
        }

        function clearInputError(input, error) {
            if (!input || !error) {
                return;
            }

            input.removeAttribute("aria-invalid");
            if (input.getAttribute("aria-describedby") === error.id) {
                input.removeAttribute("aria-describedby");
            }
            error.textContent = "";
            error.hidden = true;
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
            spacer.textContent = currentMessages["snapshots.form.balance"] ?? "Saldo";
            balanceInput.className = "table-input";
            balanceInput.type = "number";
            balanceInput.step = "0.0001";
            balanceInput.dataset.role = "balance";
            balanceInput.dataset.accountId = account.id;
            balanceInput.inputMode = "decimal";
            balanceInput.value = previousAccount?.balance ?? "";
            balanceInput.setAttribute("aria-label", `${currentMessages["snapshots.table.balance"] ?? ""}: ${formatAccountInputLabel(account)}`);
            balanceInput.addEventListener("input", () => {
                draftBalances.set(account.id, balanceInput.value);
                clearInputError(balanceInput, error);
            });
            error.id = validationErrorId(account.id);
            error.className = "bulk-input-error";
            error.dataset.validationRole = "balance";
            error.setAttribute("aria-live", "polite");
            error.hidden = true;
            lastBalance.className = "bulk-last-balance";
            lastBalance.textContent = formatLastSnapshot(account);
            cell.append(spacer, balanceInput, error, lastBalance);
            return cell;
        }

        function currentDraftValues() {
            const balances = new Map(accounts.map((account) => {
                const balanceInput = tableBody.querySelector(`[data-role='balance'][data-account-id='${account.id}']`);
                return [account.id, balanceInput?.value ?? draftBalances.get(account.id) ?? ""];
            }));

            return {
                snapshotDate: snapshotDateInput?.value || draftSnapshotDate || "",
                balances
            };
        }

        function renderCompactAccounts(previousAccounts) {
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

            tableBody.replaceChildren(...accountRows);
        }

        function targetModalWidth() {
            if (!modalRoot) {
                return null;
            }

            if (compactBulkLayout) {
                return null;
            }

            const viewportWidth = Math.max(window.innerWidth - MODAL_SIDE_MARGIN, MODAL_MIN_WIDTH);
            const contentWidth = MODAL_BASE_WIDTH + (accounts.length * MODAL_ACCOUNT_COLUMN_WIDTH);
            return Math.max(MODAL_MIN_WIDTH, Math.min(MODAL_MAX_WIDTH, Math.min(viewportWidth, contentWidth)));
        }

        function syncModalWidth() {
            if (!modalRoot) {
                return;
            }

            const nextWidth = targetModalWidth();
            if (!nextWidth) {
                modalRoot.style.removeProperty("--bulk-snapshot-modal-width");
                return;
            }

            modalRoot.style.setProperty("--bulk-snapshot-modal-width", `${Math.round(nextWidth)}px`);
        }

        function renderAccounts() {
            if (accounts.length === 0) {
                renderEmpty(currentMessages["snapshots.bulk.empty"] ?? "");
                return;
            }

            const draftValues = currentDraftValues();
            draftSnapshotDate = draftValues.snapshotDate;
            draftValues.balances.forEach((balance, accountId) => {
                draftBalances.set(accountId, balance);
            });

            const previousAccounts = new Map(accounts.map((account) => [
                account.id,
                {
                    balance: draftValues.balances.get(account.id) ?? ""
                }
            ]));

            const table = tableBody.closest(".bulk-snapshot-table");
            compactBulkLayout = isCompactBulkLayout();
            table?.classList.toggle("bulk-snapshot-table-compact", compactBulkLayout);

            if (compactBulkLayout) {
                renderCompactAccounts(previousAccounts);
                syncModalWidth();
                return;
            }

            const accountRow = document.createElement("tr");
            accountRow.append(...accounts.map(accountHeaderCell));

            const balanceRow = document.createElement("tr");
            balanceRow.append(...accounts.map((account) => createBalanceInputCell(account, previousAccounts.get(account.id))));

            tableBody.replaceChildren(accountRow, balanceRow);
            syncModalWidth();
        }

        function payloads() {
            return accounts.map((account) => ({
                account,
                payload: {
                    accountId: account.id,
                    snapshotDate: snapshotDateInput?.value ?? "",
                    balance: tableBody.querySelector(`[data-role='balance'][data-account-id='${account.id}']`)?.value ?? "",
                    snapshotType: snapshotTypeSelect.value,
                    note: noteInput.value.trim()
                }
            }));
        }

        function validateAccountPayload({payload}) {
            if (!payload.snapshotDate) {
                return currentMessages["snapshots.bulk.requiredDate"];
            }
            if (!payload.snapshotType) {
                return currentMessages["snapshots.bulk.requiredType"];
            }
            if (!payload.balance) {
                return currentMessages["snapshots.bulk.requiredBalance"];
            }
            return "";
        }

        function clearValidationErrors() {
            bulkSnapshotForm.querySelectorAll("[data-validation-role]").forEach((error) => {
                error.textContent = "";
                error.hidden = true;
            });
            bulkSnapshotForm.querySelectorAll("[aria-invalid='true']").forEach((input) => {
                input.removeAttribute("aria-invalid");
                input.removeAttribute("aria-describedby");
            });
        }

        function markInputError(input, error, message) {
            if (!input || !error) {
                return;
            }

            input.setAttribute("aria-invalid", "true");
            input.setAttribute("aria-describedby", error.id);
            error.textContent = message;
            error.hidden = false;
        }

        function balanceInputForAccount(accountId) {
            return tableBody.querySelector(`[data-role='balance'][data-account-id='${accountId}']`);
        }

        function markValidationErrors(invalidEntries) {
            const dateError = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-date-error'], [data-validation-role='date']");
            const typeError = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-type-error']");
            let firstInvalidInput = null;

            if (!snapshotDateInput?.value) {
                markInputError(snapshotDateInput, dateError, invalidEntries[0].message);
                firstInvalidInput = snapshotDateInput;
            }

            if (!snapshotTypeSelect.value) {
                markInputError(snapshotTypeSelect, typeError, currentMessages["snapshots.bulk.requiredType"]);
                if (!firstInvalidInput) {
                    firstInvalidInput = snapshotTypeSelect;
                }
            }

            invalidEntries
                .filter(({payload}) => payload.snapshotDate && !payload.balance)
                .forEach(({account, message}) => {
                    const input = balanceInputForAccount(account.id);
                    const error = bulkSnapshotForm.querySelector(`#${validationErrorId(account.id)}`);
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
                throw new Error(currentMessages["snapshots.error.accountNotFound"]);
            }

            if (response.status === 409) {
                throw new Error(currentMessages["snapshots.error.duplicate"]);
            }

            if (!response.ok) {
                throw new Error(currentMessages["snapshots.error.create"]);
            }

            return response.json();
        }

        async function loadAccounts() {
            const response = await fetch("/api/accounts");
            if (!response.ok) {
                throw new Error(currentMessages["snapshots.error.loadAccounts"]);
            }

            accounts = [...await response.json()].sort(sortAccountsForDisplay);
            renderAccounts();
        }

        async function loadSnapshots() {
            const response = await fetch("/api/snapshots");
            if (!response.ok) {
                throw new Error(currentMessages["snapshots.error.load"]);
            }

            snapshots = await response.json();
            snapshotsLoaded = true;
            renderAccounts();
        }

        async function loadData({forceReload = false} = {}) {
            if (lastLoadPromise && !forceReload) {
                return lastLoadPromise;
            }

            if (forceReload) {
                snapshotsLoaded = false;
            }

            lastLoadPromise = Promise.all([loadAccounts(), loadSnapshots()])
                .catch((error) => {
                    lastLoadPromise = null;
                    throw error;
                });

            return lastLoadPromise;
        }

        async function submit(event) {
            event.preventDefault();
            clearValidationErrors();

            const entries = payloads();
            if (entries.length === 0) {
                setFormMessage(currentMessages["snapshots.bulk.empty"], "error");
                return;
            }

            const invalidEntries = entries
                .map((entry) => ({...entry, message: validateAccountPayload(entry)}))
                .filter((entry) => entry.message);

            if (invalidEntries.length > 0) {
                markValidationErrors(invalidEntries);
                setFormMessage(currentMessages["snapshots.bulk.validationError"], "error");
                return;
            }

            if (submitButton) {
                submitButton.disabled = true;
            }
            setFormMessage("");

            try {
                const savedSnapshots = await saveSnapshots(entries);
                if (redirectOnSuccess) {
                    window.sessionStorage.setItem(MoneySnapshotUi.bulkSnapshotSuccessKey, String(savedSnapshots.length));
                    window.location.href = "/snapshots.html";
                    return;
                }

                await onSuccess?.({
                    savedSnapshots,
                    controller
                });
            } catch (error) {
                console.error("Cannot save bulk snapshots", error);
                setFormMessage(error.message, "error");
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        }

        function resetForm() {
            draftSnapshotDate = MoneySnapshotUi.localIsoDate();
            draftBalances.clear();
            bulkSnapshotForm.reset();
            snapshotDateInput.value = draftSnapshotDate;
            snapshotTypeSelect.value = "";
            noteInput.value = "";
            clearValidationErrors();
            setFormMessage("");
            renderAccounts();
            submitButton?.removeAttribute("disabled");
        }

        function focus() {
            (snapshotDateInput ?? snapshotTypeSelect ?? noteInput)?.focus();
        }

        async function prepare({forceReload = false} = {}) {
            await initialize();
            await loadData({forceReload});
            submitButton?.removeAttribute("disabled");
        }

        function handleResize() {
            window.clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = window.setTimeout(() => {
                if (accounts.length === 0) {
                    syncModalWidth();
                    return;
                }

                const nextCompactLayout = isCompactBulkLayout();
                if (nextCompactLayout !== compactBulkLayout) {
                    renderAccounts();
                    return;
                }

                syncModalWidth();
            }, 150);
        }

        function handleLanguageChange(nextMessages) {
            currentMessages = nextMessages;
            renderAccounts();
        }

        function updateUserSettings(nextUserSettings) {
            currentUserSettings = nextUserSettings;
            if (snapshotsLoaded) {
                renderAccounts();
            }
        }

        function initialize() {
            if (initializedPromise) {
                return initializedPromise;
            }

            snapshotDateInput.value = defaultSnapshotDate();
            snapshotDateInput.addEventListener("input", () => {
                draftSnapshotDate = snapshotDateInput.value;
                const error = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-date-error']");
                clearInputError(snapshotDateInput, error);
            });
            snapshotTypeSelect.addEventListener("change", () => {
                const error = bulkSnapshotForm.querySelector("[data-role='bulk-snapshot-type-error']");
                clearInputError(snapshotTypeSelect, error);
            });
            bulkSnapshotForm.addEventListener("submit", submit);
            window.addEventListener("resize", handleResize);

            initializedPromise = Promise.resolve();
            return initializedPromise;
        }

        const controller = {
            prepare,
            resetForm,
            focus,
            clearMessage: () => setFormMessage(""),
            setMessage: setFormMessage,
            handleLanguageChange,
            updateUserSettings,
            getAccountCount: () => accounts.length
        };

        return controller;
    }

    async function init({
        root,
        messages = {},
        userSettings = null,
        redirectOnSuccess = true,
        onSuccess = null,
        autoPrepare = true
    }) {
        if (!(root instanceof HTMLElement)) {
            return null;
        }

        const controller = createController(root, {
            messages,
            userSettings,
            redirectOnSuccess,
            onSuccess
        });

        if (autoPrepare) {
            await controller.prepare();
        }
        return controller;
    }

    const autoInitRoot = document.querySelector("[data-bulk-snapshot-form][data-bulk-snapshot-auto-init='true']");
    if (autoInitRoot) {
        let initialI18nState = null;

        function applyPageTitle(messages) {
            if (!messages) {
                return;
            }

            document.title = `${messages["snapshots.bulk.title"] ?? ""} | ${messages["app.name"] ?? ""}`.trim();
        }

        MoneySnapshotI18n.init({
            endpoint: "/api/snapshots/messages",
            onLanguageChange: ({messages}) => {
                applyPageTitle(messages);
                autoInitRoot.__bulkSnapshotController?.handleLanguageChange(messages);
            }
        })
            .then((state) => {
                initialI18nState = state;
                applyPageTitle(state?.messages);
                return state;
            })
            .then(() => MoneySnapshotUi.loadUserSettings())
            .then((settings) => init({
                root: autoInitRoot,
                messages: initialI18nState?.messages ?? {},
                userSettings: settings
            }))
            .then((controller) => {
                autoInitRoot.__bulkSnapshotController = controller;
            })
            .catch((error) => {
                const tableBody = autoInitRoot.querySelector("[data-role='bulk-snapshot-table-body']");
                const messageContainer = autoInitRoot.querySelector("[data-role='bulk-snapshot-message-container']");
                const message = autoInitRoot.querySelector("[data-role='bulk-snapshot-message']");
                if (tableBody) {
                    const row = document.createElement("tr");
                    const cell = document.createElement("td");
                    cell.textContent = error.message;
                    row.append(cell);
                    tableBody.replaceChildren(row);
                }
                if (message) {
                    message.textContent = error.message;
                    message.dataset.type = "error";
                }
                if (messageContainer) {
                    messageContainer.dataset.type = "error";
                    messageContainer.hidden = false;
                }
            });
    }

    return {
        init
    };
})();
