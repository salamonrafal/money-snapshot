window.MoneySnapshotSnapshotForm = (() => {
    const REMEMBER_ACCOUNT_ENABLED_KEY = "money-snapshot-remember-snapshot-account";
    const LAST_ACCOUNT_KEY = "money-snapshot-last-snapshot-account";

    function shouldRememberAccount() {
        return window.localStorage.getItem(REMEMBER_ACCOUNT_ENABLED_KEY) === "true";
    }

    function savedAccountId() {
        return window.localStorage.getItem(LAST_ACCOUNT_KEY) ?? "";
    }

    function rememberSelectedAccount(accountId, rememberAccountInput) {
        if (!rememberAccountInput) {
            return;
        }

        if (rememberAccountInput.checked) {
            window.localStorage.setItem(REMEMBER_ACCOUNT_ENABLED_KEY, "true");
            window.localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
            return;
        }

        window.localStorage.removeItem(REMEMBER_ACCOUNT_ENABLED_KEY);
        window.localStorage.removeItem(LAST_ACCOUNT_KEY);
    }

    function restoreRememberAccountPreference(rememberAccountInput) {
        if (rememberAccountInput) {
            rememberAccountInput.checked = shouldRememberAccount();
        }
    }

    function createController(root, {messages = {}, onSuccess = null, userSettings = null} = {}) {
        const snapshotForm = root;
        const modalRoot = snapshotForm.closest(".snapshot-form-modal");
        const externalMessageContainer = modalRoot?.querySelector("[data-role='snapshot-form-message-container']");
        const formMessage = snapshotForm.querySelector("[data-role='snapshot-form-message']")
            ?? externalMessageContainer?.querySelector("[data-role='snapshot-form-message']");
        const accountSelect = snapshotForm.querySelector("[data-role='snapshot-account']");
        const snapshotDateInput = snapshotForm.querySelector("[data-role='snapshot-date']");
        const balanceInput = snapshotForm.querySelector("[data-role='snapshot-balance']");
        const snapshotTypeSelect = snapshotForm.querySelector("[data-role='snapshot-type']");
        const noteInput = snapshotForm.querySelector("[data-role='snapshot-note']");
        const rememberAccountInput = snapshotForm.querySelector("[data-role='remember-snapshot-account']");
        const lastSnapshotSummary = snapshotForm.querySelector("[data-role='snapshot-last-summary']")
            ?? modalRoot?.querySelector("[data-role='snapshot-last-summary']");
        const lastSnapshotSummaryValue = snapshotForm.querySelector("[data-role='snapshot-last-summary-value']")
            ?? modalRoot?.querySelector("[data-role='snapshot-last-summary-value']");
        const submitButton = snapshotForm.querySelector("button[type='submit']")
            ?? modalRoot?.querySelector(`[form='${snapshotForm.id}'][type='submit']`)
            ?? document.querySelector(`[form='${snapshotForm.id}'][type='submit']`);
        const formMode = snapshotForm.dataset.mode;
        let currentSnapshotId = snapshotForm.dataset.snapshotId ?? "";

        let currentMessages = messages;
        let cachedAccounts = [];
        let cachedSnapshots = [];
        let loadedSnapshot = null;
        let currentUserSettings = userSettings;

        function clearFormFields() {
            snapshotForm.reset();
            accountSelect.value = "";
            snapshotDateInput.value = "";
            balanceInput.value = "";
            snapshotTypeSelect.value = "";
            noteInput.value = "";
        }

        function setFormMessage(text, type = "") {
            formMessage.textContent = text;
            formMessage.dataset.type = type;
            if (externalMessageContainer) {
                externalMessageContainer.dataset.type = type;
                externalMessageContainer.hidden = !text;
            }
        }

        function formatAccountOption(account) {
            return `${account.accountName} (${account.bankName}, ${account.currencyCode})`;
        }

        function formatDate(value) {
            if (!value) {
                return "-";
            }

            return MoneySnapshotUi.formatDateValue(value, currentUserSettings);
        }

        function formatCurrencyAmount(snapshot) {
            if (!snapshot) {
                return "-";
            }

            return MoneySnapshotUi.formatMoneyValue(snapshot.balance, currentUserSettings);
        }

        function accountExists(accountId) {
            return cachedAccounts.some((account) => account.id === accountId);
        }

        function lastSnapshotForSelectedAccount() {
            if (!accountSelect.value) {
                return null;
            }

            return cachedSnapshots
                .filter((snapshot) => snapshot.accountId === accountSelect.value)
                .sort((left, right) => right.snapshotDate.localeCompare(left.snapshotDate))[0] ?? null;
        }

        function renderAccountOptions() {
            const rememberedAccountId = formMode === "create" && shouldRememberAccount() ? savedAccountId() : "";
            const selectedValue = accountSelect.value || loadedSnapshot?.accountId || rememberedAccountId || "";
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = currentMessages["snapshots.form.accountPlaceholder"] ?? "";

            accountSelect.replaceChildren(
                placeholder,
                ...cachedAccounts.map((account) => {
                    const option = document.createElement("option");
                    option.value = account.id;
                    option.textContent = formatAccountOption(account);
                    return option;
                })
            );
            accountSelect.value = accountExists(selectedValue) ? selectedValue : "";
        }

        function setDefaultSnapshotDate() {
            if (formMode !== "edit") {
                snapshotDateInput.value = MoneySnapshotUi.localIsoDate();
            }
        }

        function setRememberedAccountDateFromLastSnapshot() {
            if (formMode !== "create" || !rememberAccountInput?.checked) {
                setDefaultSnapshotDate();
                return;
            }

            const lastSnapshot = lastSnapshotForSelectedAccount();
            snapshotDateInput.value = lastSnapshot?.snapshotDate ?? MoneySnapshotUi.localIsoDate();
        }

        function updateLastSnapshotSummary() {
            if (!lastSnapshotSummary || !lastSnapshotSummaryValue) {
                return;
            }

            const lastSnapshot = lastSnapshotForSelectedAccount();
            if (!accountSelect.value) {
                lastSnapshotSummary.hidden = true;
                lastSnapshotSummaryValue.textContent = "-";
                return;
            }

            lastSnapshotSummary.hidden = false;
            lastSnapshotSummaryValue.textContent = lastSnapshot
                ? `${formatDate(lastSnapshot.snapshotDate)} · ${formatCurrencyAmount(lastSnapshot)}`
                : currentMessages["snapshots.form.noLastSnapshot"] ?? "-";
        }

        function rememberCurrentAccountIfEnabled() {
            if (rememberAccountInput?.checked && accountSelect.value) {
                rememberSelectedAccount(accountSelect.value, rememberAccountInput);
            }
        }

        async function loadAccounts() {
            const response = await fetch("/api/accounts");
            if (!response.ok) {
                throw new Error(currentMessages["snapshots.error.loadAccounts"]);
            }

            cachedAccounts = await response.json();
            renderAccountOptions();
            updateLastSnapshotSummary();
        }

        async function loadSnapshotHistory() {
            if (formMode !== "create") {
                return;
            }

            const response = await fetch("/api/snapshots");
            if (!response.ok) {
                throw new Error(currentMessages["snapshots.error.load"]);
            }

            cachedSnapshots = await response.json();
            updateLastSnapshotSummary();
        }

        async function loadSnapshot() {
            if (formMode !== "edit" || !currentSnapshotId) {
                return;
            }

            const response = await fetch(`/api/snapshots/${encodeURIComponent(currentSnapshotId)}`);
            if (response.status === 404) {
                throw new Error(currentMessages["snapshots.error.notFound"]);
            }

            if (!response.ok) {
                throw new Error(currentMessages["snapshots.error.loadSnapshot"]);
            }

            loadedSnapshot = await response.json();
            accountSelect.value = loadedSnapshot.accountId;
            snapshotDateInput.value = loadedSnapshot.snapshotDate;
            balanceInput.value = loadedSnapshot.balance;
            snapshotTypeSelect.value = loadedSnapshot.snapshotType ?? "";
            noteInput.value = loadedSnapshot.note ?? "";
        }

        async function saveSnapshot(payload) {
            const isEdit = formMode === "edit";
            const response = await fetch(isEdit ? `/api/snapshots/${encodeURIComponent(currentSnapshotId)}` : "/api/snapshots", {
                method: isEdit ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 404) {
                throw new Error(currentMessages["snapshots.error.accountNotFound"]);
            }

            if (response.status === 409) {
                throw new Error(currentMessages["snapshots.error.duplicate"]);
            }

            if (!response.ok) {
                throw new Error(currentMessages[isEdit ? "snapshots.error.update" : "snapshots.error.create"]);
            }

            return response.json();
        }

        async function handleSubmit(event) {
            event.preventDefault();
            let shouldRefocusAccount = true;

            const payload = {
                accountId: accountSelect.value,
                snapshotDate: snapshotDateInput.value,
                balance: balanceInput.value,
                snapshotType: snapshotTypeSelect.value,
                note: noteInput.value.trim()
            };

            if (!payload.accountId || !payload.snapshotDate || !payload.balance || !payload.snapshotType) {
                setFormMessage(currentMessages["snapshots.form.required"], "error");
                return;
            }

            submitButton.disabled = true;
            setFormMessage("");

            try {
                const savedSnapshot = await saveSnapshot(payload);
                if (formMode === "create") {
                    cachedSnapshots = [savedSnapshot, ...cachedSnapshots.filter((snapshot) => snapshot.id !== savedSnapshot.id)];
                }
                rememberSelectedAccount(payload.accountId, rememberAccountInput);

                if (typeof onSuccess === "function") {
                    const handled = await onSuccess({
                        savedSnapshot,
                        formMode,
                        rememberAccountEnabled: Boolean(rememberAccountInput?.checked),
                        snapshotForm,
                        setFormMessage,
                        resetForm
                    });
                    if (handled === true) {
                        shouldRefocusAccount = false;
                        return;
                    }
                }

                if (formMode === "edit") {
                    window.location.href = "/snapshots.html";
                    return;
                }

                resetForm();
                setFormMessage(currentMessages["snapshots.form.success"], "success");
            } catch (error) {
                setFormMessage(error.message, "error");
            } finally {
                submitButton.disabled = false;
                if (shouldRefocusAccount) {
                    accountSelect.focus();
                }
            }
        }

        function resetForm() {
            snapshotForm.reset();
            restoreRememberAccountPreference(rememberAccountInput);
            renderAccountOptions();
            setRememberedAccountDateFromLastSnapshot();
            updateLastSnapshotSummary();
        }

        function setSnapshotId(nextSnapshotId) {
            currentSnapshotId = nextSnapshotId ?? "";
            snapshotForm.dataset.snapshotId = currentSnapshotId;
        }

        async function loadSnapshotIntoForm(nextSnapshotId = currentSnapshotId) {
            if (formMode !== "edit") {
                return;
            }

            setSnapshotId(nextSnapshotId);
            loadedSnapshot = null;
            clearFormFields();
            renderAccountOptions();
            setFormMessage("");
            await loadSnapshot();
        }

        function handleLanguageChange(nextMessages) {
            currentMessages = nextMessages;
            renderAccountOptions();
            updateLastSnapshotSummary();
        }

        function updateUserSettings(nextUserSettings) {
            currentUserSettings = nextUserSettings;
            updateLastSnapshotSummary();
        }

        async function initialize() {
            setDefaultSnapshotDate();
            restoreRememberAccountPreference(rememberAccountInput);

            rememberAccountInput?.addEventListener("change", () => {
                if (!rememberAccountInput.checked) {
                    window.localStorage.removeItem(REMEMBER_ACCOUNT_ENABLED_KEY);
                    window.localStorage.removeItem(LAST_ACCOUNT_KEY);
                    return;
                }

                window.localStorage.setItem(REMEMBER_ACCOUNT_ENABLED_KEY, "true");
                rememberCurrentAccountIfEnabled();
                setRememberedAccountDateFromLastSnapshot();
                updateLastSnapshotSummary();
            });

            accountSelect.addEventListener("change", () => {
                rememberCurrentAccountIfEnabled();
                setRememberedAccountDateFromLastSnapshot();
                updateLastSnapshotSummary();
            });

            snapshotForm.addEventListener("submit", handleSubmit);

            await loadAccounts();
            await loadSnapshotHistory();
            await loadSnapshot();
            setRememberedAccountDateFromLastSnapshot();
            updateLastSnapshotSummary();
        }

        return {
            clearMessage: () => setFormMessage(""),
            showMessage: setFormMessage,
            initialize,
            handleLanguageChange,
            updateUserSettings,
            resetForm,
            focus: () => accountSelect.focus(),
            loadSnapshotIntoForm,
            setSnapshotId
        };
    }

    async function init({root, messages = {}, onSuccess = null, userSettings = null} = {}) {
        if (!root || root.dataset.snapshotFormInitialized === "true") {
            return null;
        }

        const settings = userSettings ?? await MoneySnapshotUi.loadUserSettings();
        const controller = createController(root, {
            messages,
            onSuccess,
            userSettings: settings
        });
        root.dataset.snapshotFormInitialized = "true";
        await controller.initialize();
        return controller;
    }

    async function initPage() {
        const forms = [...document.querySelectorAll("[data-snapshot-form]")];
        if (forms.length === 0) {
            return;
        }

        let pageControllers = [];
        MoneySnapshotI18n.init({
            endpoint: "/api/snapshots/messages",
            onLanguageChange: ({messages}) => {
                const form = forms[0];
                const titleKey = form?.dataset.mode === "edit" ? "snapshots.form.edit.title" : "snapshots.form.title";
                document.title = `${messages[titleKey]} | ${messages["app.name"]}`;
                pageControllers.forEach((controller) => controller?.handleLanguageChange(messages));
            }
        })
            .then(async ({messages}) => {
                const userSettings = await MoneySnapshotUi.loadUserSettings();
                const controllers = await Promise.all(forms.map((form) => init({
                    root: form,
                    messages,
                    userSettings
                })));
                pageControllers = controllers.filter(Boolean);
            })
            .catch((error) => {
                forms.forEach((form) => {
                    const formMessage = form.querySelector("[data-role='snapshot-form-message']")
                        ?? form.closest(".snapshot-form-modal")?.querySelector("[data-role='snapshot-form-message']");
                    if (!formMessage) {
                        return;
                    }

                    formMessage.textContent = error.message;
                    formMessage.dataset.type = "error";
                });
            });
    }

    if (document.body?.dataset.snapshotFormPage === "true") {
        initPage();
    }

    return {
        init,
        initPage
    };
})();
