(() => {
    const bulkSnapshotTriggers = document.querySelectorAll("[data-launchbar-shortcut-action='bulk-snapshots']");
    const liabilityRepaymentTriggers = document.querySelectorAll("[data-launchbar-shortcut-action='liability-repayment']");

    if (bulkSnapshotTriggers.length === 0 && liabilityRepaymentTriggers.length === 0) {
        return;
    }

    const toastManager = MoneySnapshotUi.createToastManager({durationMs: 4200});
    const scriptPromises = new Map();
    const messagesCache = new Map();
    let userSettingsPromise = null;
    let bulkSnapshotController = null;
    let bulkSnapshotControllerPromise = null;
    let liabilityRepaymentMessages = {};
    let cachedLiabilities = [];
    let selectedLiabilityId = "";

    const bulkSnapshotModalElement = document.getElementById("shortcut-bulk-snapshot-form-modal");
    const bulkSnapshotFormElement = bulkSnapshotModalElement?.querySelector("[data-bulk-snapshot-form]") ?? null;
    const bulkSnapshotModal = bulkSnapshotModalElement
        ? MoneySnapshotUi.createModal({
            modalSelector: "#shortcut-bulk-snapshot-form-modal",
            closeSelectors: ["#shortcut-bulk-snapshot-form-modal [data-bulk-snapshot-modal-close]"]
        })
        : null;

    const repaymentModalElement = document.getElementById("shortcut-liability-repayment-modal");
    const repaymentModal = repaymentModalElement
        ? MoneySnapshotUi.createModal({
            modalSelector: "#shortcut-liability-repayment-modal",
            closeSelectors: ["#shortcut-liability-repayment-modal [data-shortcut-liability-repayment-modal-close]"]
        })
        : null;
    const repaymentForm = document.getElementById("shortcut-liability-repayment-form");
    const repaymentMessageContainer = document.getElementById("shortcut-liability-repayment-form-message-container");
    const repaymentMessage = document.getElementById("shortcut-liability-repayment-form-message");
    const repaymentSubmitButton = document.getElementById("shortcut-liability-repayment-submit");
    const repaymentLiabilitySelect = document.getElementById("shortcut-liability-repayment-liability");
    const repaymentDateInput = document.getElementById("shortcut-liability-repayment-date");
    const repaymentSourceTypeInput = document.getElementById("shortcut-liability-repayment-source-type");
    const repaymentSourceAmountInput = document.getElementById("shortcut-liability-repayment-source-amount");
    const repaymentFinalAmountInput = document.getElementById("shortcut-liability-repayment-final-amount");
    const repaymentSourceLabel = document.getElementById("shortcut-liability-repayment-source-label");
    const repaymentNoteInput = document.getElementById("shortcut-liability-repayment-note");
    const repaymentControls = {
        liabilityId: repaymentLiabilitySelect,
        repaymentDate: repaymentDateInput,
        sourceType: repaymentSourceTypeInput,
        sourceAmount: repaymentSourceAmountInput
    };

    function currentLanguage() {
        const savedLanguage = window.localStorage.getItem("money-snapshot-language");
        return ["pl", "en"].includes(savedLanguage) ? savedLanguage : "pl";
    }

    function shouldOpenModalFromClick(event) {
        return event.button === 0
            && !event.defaultPrevented
            && !event.metaKey
            && !event.ctrlKey
            && !event.shiftKey
            && !event.altKey;
    }

    function loadScript(src) {
        if (scriptPromises.has(src)) {
            return scriptPromises.get(src);
        }

        const promise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src^='${src}']`);
            if (existingScript) {
                existingScript.addEventListener("load", resolve, {once: true});
                existingScript.addEventListener("error", reject, {once: true});
                if (window.MoneySnapshotBulkSnapshotForm) {
                    resolve();
                }
                return;
            }

            const script = document.createElement("script");
            script.src = `${src}?v=20260703-launchbar-shortcut-actions`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.append(script);
        });
        scriptPromises.set(src, promise);
        return promise;
    }

    async function loadMessages(endpoint) {
        const language = currentLanguage();
        const cacheKey = `${endpoint}:${language}`;
        if (messagesCache.has(cacheKey)) {
            return messagesCache.get(cacheKey);
        }

        const response = await fetch(`${endpoint}?lang=${encodeURIComponent(language)}`);
        if (!response.ok) {
            throw new Error(`Cannot load messages for ${endpoint}`);
        }

        const messages = await response.json();
        messagesCache.set(cacheKey, messages);
        return messages;
    }

    function userSettings() {
        if (!userSettingsPromise) {
            userSettingsPromise = MoneySnapshotUi.loadUserSettings();
        }
        return userSettingsPromise;
    }

    function notifyShortcutActionSaved(type) {
        window.dispatchEvent(new CustomEvent("money-snapshot:shortcut-action-saved", {
            detail: {type}
        }));
    }

    function formatMessage(template, values = {}) {
        return Object.entries(values).reduce((message, [key, value]) => {
            const pattern = new RegExp(`\\{${key}\\}`, "gi");
            return message.replace(pattern, String(value));
        }, template ?? "");
    }

    async function ensureBulkSnapshotController() {
        if (bulkSnapshotController) {
            return bulkSnapshotController;
        }
        if (bulkSnapshotControllerPromise) {
            return bulkSnapshotControllerPromise;
        }
        if (!bulkSnapshotFormElement || !bulkSnapshotModal) {
            return null;
        }

        bulkSnapshotControllerPromise = Promise.all([
            loadScript("/js/snapshot-bulk.js"),
            loadMessages("/api/snapshots/messages"),
            userSettings()
        ]).then(([, messages, settings]) => {
            MoneySnapshotI18n.applyMessages(
                messages,
                currentLanguage(),
                bulkSnapshotModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
            );
            return window.MoneySnapshotBulkSnapshotForm.init({
                root: bulkSnapshotFormElement,
                messages,
                userSettings: settings,
                redirectOnSuccess: false,
                onSuccess: ({savedSnapshots, controller}) => {
                    controller.resetForm();
                    bulkSnapshotModal.close();
                    notifyShortcutActionSaved("bulk-snapshots");
                    const successMessage = formatMessage(
                        messages["snapshots.bulk.success"] ?? messages["snapshots.form.success"] ?? "",
                        {count: savedSnapshots?.length ?? 0}
                    );
                    toastManager.show(successMessage, {type: "success"});
                },
                autoPrepare: false
            });
        }).then((controller) => {
            bulkSnapshotController = controller;
            return controller;
        }).finally(() => {
            bulkSnapshotControllerPromise = null;
        });

        return bulkSnapshotControllerPromise;
    }

    async function openBulkSnapshotModal(trigger) {
        const controller = await ensureBulkSnapshotController();
        if (!controller) {
            window.location.href = trigger.href;
            return;
        }

        await controller.prepare({forceReload: true});
        controller.resetForm();
        controller.clearMessage();
        bulkSnapshotModal.open({trigger});
        window.requestAnimationFrame(() => controller.focus());
    }

    function normalizeDecimalInput(rawValue) {
        const trimmedValue = `${rawValue ?? ""}`.trim();
        if (!trimmedValue) {
            return null;
        }

        const normalizedValue = trimmedValue.replace(/\s+/g, "").replace(",", ".");
        return /^\d+(\.\d{1,4})?$/.test(normalizedValue) ? normalizedValue : null;
    }

    function setRepaymentMessage(text, type = "") {
        if (repaymentMessage) {
            repaymentMessage.textContent = text;
            repaymentMessage.dataset.type = type;
        }
        if (repaymentMessageContainer) {
            repaymentMessageContainer.dataset.type = type || "error";
            repaymentMessageContainer.hidden = !text;
        }
    }

    function clearRepaymentHighlights() {
        Object.values(repaymentControls).forEach((input) => input?.removeAttribute("aria-invalid"));
    }

    function highlightRepaymentField(input) {
        input?.setAttribute("aria-invalid", "true");
    }

    function focusFirstHighlightedRepaymentField() {
        Object.values(repaymentControls).find((input) => input?.getAttribute("aria-invalid") === "true")?.focus();
    }

    function repaymentSourceType() {
        return repaymentSourceTypeInput?.value === "CURRENT_AMOUNT" ? "CURRENT_AMOUNT" : "REPAYMENT_AMOUNT";
    }

    function selectedLiability() {
        return cachedLiabilities.find((liability) => liability.id === repaymentLiabilitySelect?.value) ?? null;
    }

    function applyRepaymentSourceLabel() {
        if (!repaymentSourceLabel) {
            return;
        }

        repaymentSourceLabel.textContent = repaymentSourceType() === "CURRENT_AMOUNT"
            ? (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountCurrentAmount"] ?? "Aktualne saldo")
            : (liabilityRepaymentMessages["liabilityRepayment.form.sourceAmountRepaymentAmount"] ?? "Kwota spłaty");
    }

    async function formatMoney(value) {
        return MoneySnapshotUi.formatMoneyValue(value, await userSettings());
    }

    async function updateRepaymentFinalAmountPreview() {
        if (!repaymentFinalAmountInput) {
            return;
        }

        const rawValue = normalizeDecimalInput(repaymentSourceAmountInput?.value);
        if (rawValue === null) {
            repaymentFinalAmountInput.value = "-";
            return;
        }

        const sourceValue = Number(rawValue);
        const liability = selectedLiability();
        if (!Number.isFinite(sourceValue) || !liability) {
            repaymentFinalAmountInput.value = "-";
            return;
        }

        repaymentFinalAmountInput.value = repaymentSourceType() === "CURRENT_AMOUNT"
            ? await formatMoney(sourceValue)
            : await formatMoney(Number(liability.currentAmount ?? 0) - sourceValue);
    }

    function setRepaymentInputsEnabled(hasLiabilities) {
        if (repaymentSourceTypeInput) {
            repaymentSourceTypeInput.disabled = !hasLiabilities;
        }
        if (repaymentSourceAmountInput) {
            repaymentSourceAmountInput.disabled = !hasLiabilities;
        }
        if (repaymentFinalAmountInput) {
            repaymentFinalAmountInput.disabled = !hasLiabilities;
        }
        if (repaymentSubmitButton) {
            repaymentSubmitButton.disabled = !hasLiabilities;
        }
    }

    async function syncRepaymentSourceAmountFromSelection() {
        if (!repaymentSourceAmountInput) {
            return;
        }

        const currentAmount = Number(selectedLiability()?.currentAmount ?? 0);
        repaymentSourceAmountInput.value = repaymentSourceType() === "CURRENT_AMOUNT" ? `${currentAmount}` : "0";
        await updateRepaymentFinalAmountPreview();
    }

    async function renderRepaymentLiabilityOptions() {
        if (!repaymentLiabilitySelect) {
            return;
        }

        const settings = await userSettings();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = liabilityRepaymentMessages["liabilityRepayment.form.liabilityPlaceholder"] ?? "";

        repaymentLiabilitySelect.replaceChildren(
            placeholder,
            ...cachedLiabilities.map((liability) => {
                const option = document.createElement("option");
                option.value = liability.id;
                option.textContent = `${liability.name} · ${liability.bankName} · ${MoneySnapshotUi.formatMoneyValue(Number(liability.currentAmount ?? 0), settings)}`;
                return option;
            })
        );

        if (selectedLiabilityId) {
            repaymentLiabilitySelect.value = selectedLiabilityId;
        }

        const hasLiabilities = cachedLiabilities.length > 0;
        repaymentLiabilitySelect.disabled = !hasLiabilities;
        setRepaymentInputsEnabled(hasLiabilities);
        if (!hasLiabilities) {
            setRepaymentMessage(liabilityRepaymentMessages["liabilityRepayment.error.noLiabilities"] ?? "", "error");
        } else if (repaymentMessage?.dataset.type === "error") {
            setRepaymentMessage("", "");
        }

        applyRepaymentSourceLabel();
        await syncRepaymentSourceAmountFromSelection();
    }

    async function loadRepaymentMessages() {
        liabilityRepaymentMessages = await loadMessages("/api/liability-repayment/messages");
        if (repaymentModalElement) {
            MoneySnapshotI18n.applyMessages(
                liabilityRepaymentMessages,
                currentLanguage(),
                repaymentModalElement.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")
            );
        }
    }

    async function loadLiabilities() {
        const response = await fetch("/api/liabilities");
        if (!response.ok) {
            throw new Error(liabilityRepaymentMessages["liabilityRepayment.error.loadLiabilities"] ?? "Cannot load liabilities.");
        }

        const dashboard = await response.json();
        cachedLiabilities = dashboard.liabilities ?? [];
        await renderRepaymentLiabilityOptions();
    }

    function resetRepaymentForm() {
        repaymentForm?.reset();
        clearRepaymentHighlights();
        setRepaymentMessage("");
        if (repaymentSourceTypeInput) {
            repaymentSourceTypeInput.value = "REPAYMENT_AMOUNT";
        }
        if (repaymentDateInput && !repaymentDateInput.value) {
            repaymentDateInput.value = MoneySnapshotUi.localIsoDate();
        }
        if (repaymentSubmitButton) {
            repaymentSubmitButton.disabled = false;
        }
    }

    function repaymentPayloadFromForm() {
        return {
            repaymentDate: repaymentDateInput?.value || null,
            sourceType: repaymentSourceType(),
            sourceAmount: normalizeDecimalInput(repaymentSourceAmountInput?.value),
            note: repaymentNoteInput?.value.trim() ?? ""
        };
    }

    function validateRepaymentPayload(payload) {
        if (!repaymentLiabilitySelect?.value || !payload.repaymentDate || !payload.sourceType || !payload.sourceAmount) {
            return "required";
        }

        const liability = selectedLiability();
        if (!liability) {
            return "required";
        }

        const sourceValue = Number(payload.sourceAmount);
        const baseValue = Number(liability.currentAmount ?? 0);
        if (!Number.isFinite(sourceValue) || sourceValue < 0 || sourceValue > baseValue) {
            return "exceedsBalance";
        }

        return "";
    }

    async function saveRepayment(liabilityId, payload) {
        const response = await fetch(`/api/liabilities/${encodeURIComponent(liabilityId)}/repayments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return;
        }

        let errorPayload = null;
        try {
            errorPayload = await response.json();
        } catch {
        }
        const error = new Error(errorPayload?.message ?? liabilityRepaymentMessages["liabilityRepayment.error.save"] ?? "Cannot save repayment.");
        error.fieldErrors = errorPayload?.fieldErrors ?? null;
        throw error;
    }

    async function openRepaymentModal(trigger) {
        if (!repaymentModal || !repaymentForm) {
            window.location.href = trigger.href;
            return;
        }

        await loadRepaymentMessages();
        await loadLiabilities();
        resetRepaymentForm();
        await renderRepaymentLiabilityOptions();
        repaymentModal.open({trigger});
    }

    repaymentLiabilitySelect?.addEventListener("change", () => {
        selectedLiabilityId = repaymentLiabilitySelect.value;
        syncRepaymentSourceAmountFromSelection().catch(console.error);
    });
    repaymentSourceTypeInput?.addEventListener("change", () => {
        applyRepaymentSourceLabel();
        syncRepaymentSourceAmountFromSelection().catch(console.error);
    });
    repaymentSourceAmountInput?.addEventListener("input", () => updateRepaymentFinalAmountPreview().catch(console.error));
    repaymentDateInput?.addEventListener("input", () => updateRepaymentFinalAmountPreview().catch(console.error));
    Object.values(repaymentControls).forEach((input) => {
        input?.addEventListener("input", () => input.removeAttribute("aria-invalid"));
        input?.addEventListener("change", () => input.removeAttribute("aria-invalid"));
    });

    repaymentForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearRepaymentHighlights();

        const liabilityId = repaymentLiabilitySelect?.value ?? "";
        const payload = repaymentPayloadFromForm();
        const validationError = validateRepaymentPayload(payload);
        if (validationError === "required") {
            highlightRepaymentField(!liabilityId ? repaymentLiabilitySelect : null);
            highlightRepaymentField(!payload.repaymentDate ? repaymentDateInput : null);
            highlightRepaymentField(!payload.sourceType ? repaymentSourceTypeInput : null);
            highlightRepaymentField(!payload.sourceAmount ? repaymentSourceAmountInput : null);
            setRepaymentMessage(liabilityRepaymentMessages["liabilityRepayment.error.required"] ?? "", "error");
            focusFirstHighlightedRepaymentField();
            return;
        }
        if (validationError === "exceedsBalance") {
            highlightRepaymentField(repaymentSourceAmountInput);
            setRepaymentMessage(liabilityRepaymentMessages["liabilityRepayment.error.amountExceedsBalance"] ?? "", "error");
            focusFirstHighlightedRepaymentField();
            return;
        }

        if (repaymentSubmitButton) {
            repaymentSubmitButton.disabled = true;
        }
        setRepaymentMessage("");

        try {
            await saveRepayment(liabilityId, payload);
            repaymentModal.close();
            resetRepaymentForm();
            notifyShortcutActionSaved("liability-repayment");
            toastManager.show(liabilityRepaymentMessages["liabilityRepayment.form.success"] ?? "", {type: "success"});
        } catch (error) {
            if (error.fieldErrors) {
                if (error.fieldErrors.liabilityId) {
                    highlightRepaymentField(repaymentLiabilitySelect);
                }
                if (error.fieldErrors.repaymentDate) {
                    highlightRepaymentField(repaymentDateInput);
                }
                if (error.fieldErrors.sourceType) {
                    highlightRepaymentField(repaymentSourceTypeInput);
                }
                if (error.fieldErrors.sourceAmount) {
                    highlightRepaymentField(repaymentSourceAmountInput);
                }
                focusFirstHighlightedRepaymentField();
            }
            setRepaymentMessage(error.message, "error");
            if (repaymentSubmitButton) {
                repaymentSubmitButton.disabled = false;
            }
        }
    });

    bulkSnapshotTriggers.forEach((trigger) => {
        trigger.addEventListener("click", async (event) => {
            if (!shouldOpenModalFromClick(event)) {
                return;
            }

            event.preventDefault();
            try {
                await openBulkSnapshotModal(trigger);
            } catch (error) {
                console.error(error);
                toastManager.show(error.message, {type: "error"});
                window.location.href = trigger.href;
            }
        });
    });

    liabilityRepaymentTriggers.forEach((trigger) => {
        trigger.addEventListener("click", async (event) => {
            if (!shouldOpenModalFromClick(event)) {
                return;
            }

            event.preventDefault();
            try {
                await openRepaymentModal(trigger);
            } catch (error) {
                console.error(error);
                toastManager.show(error.message, {type: "error"});
                window.location.href = trigger.href;
            }
        });
    });
})();
