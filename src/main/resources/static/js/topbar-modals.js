(() => {
    const profileTrigger = document.querySelector("[data-topbar-modal-trigger='profile']");
    const settingsTrigger = document.querySelector("[data-topbar-modal-trigger='settings']");
    const logoutForm = document.querySelector("#topbar-logout-form");
    const logoutConfirmButton = document.querySelector("#topbar-logout-confirm-button");
    const profileForm = document.querySelector("#topbar-profile-form");
    const settingsForm = document.querySelector("#topbar-settings-form");

    if (!profileTrigger || !settingsTrigger || !logoutForm || !logoutConfirmButton || !profileForm || !settingsForm) {
        return;
    }

    const profileModal = MoneySnapshotUi.createModal({
        modalSelector: "#topbar-profile-modal",
        closeSelectors: ["[data-topbar-profile-modal-close]"]
    });
    const settingsModal = MoneySnapshotUi.createModal({
        modalSelector: "#topbar-settings-modal",
        closeSelectors: ["[data-topbar-settings-modal-close]"]
    });
    const logoutConfirmModal = MoneySnapshotUi.createModal({
        modalSelector: "#topbar-logout-confirm-modal",
        closeSelectors: ["#topbar-logout-cancel-button"]
    });
    const toastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});

    const profileEmailInput = document.querySelector("#topbar-profile-email");
    const profileFirstNameInput = document.querySelector("#topbar-profile-first-name");
    const profileLastNameInput = document.querySelector("#topbar-profile-last-name");
    const profileDescriptionInput = document.querySelector("#topbar-profile-description");
    const profilePasswordInput = document.querySelector("#topbar-profile-password");
    const settingsDefaultCurrencySelect = document.querySelector("#topbar-settings-default-currency");
    const settingsThemeSelect = document.querySelector("#topbar-settings-theme");
    const settingsDateTimeFormatInput = document.querySelector("#topbar-settings-date-time-format");
    const settingsMoneyFormatInput = document.querySelector("#topbar-settings-money-format");
    const settingsBillingMonthStartDayInput = document.querySelector("#topbar-settings-billing-month-start-day");

    let messages = {};
    let messagesLanguage = "";
    let logoutConfirmed = false;

    function showToast(text, type = "") {
        if (!text) {
            return;
        }

        toastManager.clear();
        toastManager.show(text, {type});
    }

    function currentLanguage() {
        const language = document.documentElement.lang || "pl";
        return language.split("-")[0];
    }

    function shouldOpenModal(event) {
        return event.button === 0
            && !event.metaKey
            && !event.ctrlKey
            && !event.shiftKey
            && !event.altKey;
    }

    function setFormDisabled(form, disabled) {
        const linkedElements = document.querySelectorAll(`[form='${form.id}']`);
        [...form.querySelectorAll("button, input, select, textarea"), ...linkedElements].forEach((field) => {
            if (field.dataset.initialDisabled === undefined) {
                field.dataset.initialDisabled = field.disabled ? "true" : "false";
            }
            field.disabled = disabled || field.dataset.initialDisabled === "true";
        });
    }

    function applyModalMessages() {
        const language = messagesLanguage || currentLanguage();
        [profileModal.modal, settingsModal.modal, logoutConfirmModal.modal]
            .filter(Boolean)
            .forEach((modalRoot) => {
                const translatableNodes = modalRoot.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]");
                MoneySnapshotI18n.applyMessages(messages, language, translatableNodes);
            });
    }

    async function ensureMessages() {
        const language = currentLanguage();
        if (messagesLanguage === language && Object.keys(messages).length > 0) {
            return messages;
        }

        const response = await fetch(`/api/topbar/messages?lang=${encodeURIComponent(language)}`);
        if (!response.ok) {
            throw new Error("Cannot load topbar messages.");
        }

        messages = await response.json();
        messagesLanguage = language;
        applyModalMessages();
        return messages;
    }

    function fillProfileForm(user) {
        profileEmailInput.value = user.email ?? "";
        profileFirstNameInput.value = user.firstName ?? "";
        profileLastNameInput.value = user.lastName ?? "";
        profileDescriptionInput.value = user.description ?? "";
        profilePasswordInput.value = "";
    }

    async function loadProfile() {
        const response = await fetch("/api/users/me");
        if (!response.ok) {
            throw new Error(messages["profile.error.load"] ?? "Cannot load profile.");
        }

        fillProfileForm(await response.json());
    }

    async function saveProfile() {
        const response = await fetch("/api/users/me", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                firstName: profileFirstNameInput.value.trim(),
                lastName: profileLastNameInput.value.trim(),
                description: profileDescriptionInput.value.trim() || null,
                password: profilePasswordInput.value || null
            })
        });

        if (!response.ok) {
            throw new Error(messages["profile.error.update"] ?? "Cannot update profile.");
        }

        fillProfileForm(await response.json());
    }

    function normalizedBillingMonthStartDayValue() {
        const rawValue = settingsBillingMonthStartDayInput.value.trim();
        if (!/^\d+$/.test(rawValue)) {
            return null;
        }

        const numericValue = Number(rawValue);
        if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 31) {
            return null;
        }

        return String(numericValue);
    }

    function fillSettingsForm(settings) {
        settingsDefaultCurrencySelect.value = settings.defaultCurrency ?? "PLN";
        settingsThemeSelect.value = settings.theme ?? "light";
        settingsDateTimeFormatInput.value = settings.dateTimeFormat ?? "Y-m-d H:m";
        settingsMoneyFormatInput.value = settings.moneyFormat ?? "### ###,00 zł";
        settingsBillingMonthStartDayInput.value = settings.billingMonthStartDay ?? 1;
    }

    async function loadSettings() {
        const response = await fetch("/api/users/me/settings");
        if (!response.ok) {
            throw new Error(messages["settings.error.load"] ?? "Cannot load settings.");
        }

        fillSettingsForm(await response.json());
    }

    async function saveSettings() {
        const billingMonthStartDay = normalizedBillingMonthStartDayValue();
        const response = await fetch("/api/users/me/settings", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                values: {
                    defaultCurrency: settingsDefaultCurrencySelect.value,
                    theme: settingsThemeSelect.value,
                    dateTimeFormat: settingsDateTimeFormatInput.value.trim(),
                    moneyFormat: settingsMoneyFormatInput.value.trim(),
                    billingMonthStartDay
                }
            })
        });

        if (!response.ok) {
            throw new Error(messages["settings.error.update"] ?? "Cannot save settings.");
        }

        const savedSettings = await response.json();
        fillSettingsForm(savedSettings);
        MoneySnapshotUi.applyTheme(savedSettings.theme ?? settingsThemeSelect.value);
        MoneySnapshotUi.clearUserSettingsCache();
    }

    async function openProfileModal(trigger) {
        await ensureMessages();
        setFormDisabled(profileForm, true);
        profileModal.open({trigger});
        try {
            await loadProfile();
            setFormDisabled(profileForm, false);
        } catch (error) {
            profileModal.close();
            showToast(error.message, "error");
        }
    }

    async function openSettingsModal(trigger) {
        await ensureMessages();
        setFormDisabled(settingsForm, true);
        settingsModal.open({trigger});
        try {
            await loadSettings();
            setFormDisabled(settingsForm, false);
        } catch (error) {
            settingsModal.close();
            showToast(error.message, "error");
        }
    }

    profileTrigger.addEventListener("click", async (event) => {
        if (!shouldOpenModal(event)) {
            return;
        }

        event.preventDefault();
        try {
            await openProfileModal(profileTrigger);
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    settingsTrigger.addEventListener("click", async (event) => {
        if (!shouldOpenModal(event)) {
            return;
        }

        event.preventDefault();
        try {
            await openSettingsModal(settingsTrigger);
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    logoutForm.addEventListener("submit", async (event) => {
        if (logoutConfirmed) {
            return;
        }

        event.preventDefault();
        try {
            await ensureMessages();
            logoutConfirmModal.open({trigger: logoutForm.querySelector("button[type='submit']")});
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    logoutConfirmButton.addEventListener("click", () => {
        logoutConfirmed = true;
        logoutConfirmModal.close();
        logoutForm.submit();
    });

    profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!profileFirstNameInput.value.trim() || !profileLastNameInput.value.trim()) {
            showToast(messages["profile.form.required"] ?? "Fill in first and last name.", "error");
            return;
        }

        setFormDisabled(profileForm, true);
        try {
            await ensureMessages();
            await saveProfile();
            profileModal.close();
            showToast(messages["profile.form.success"] ?? "Profile has been saved.", "success");
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormDisabled(profileForm, false);
        }
    });

    settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const billingMonthStartDay = normalizedBillingMonthStartDayValue();
        if (!settingsDateTimeFormatInput.value.trim()
                || !settingsMoneyFormatInput.value.trim()
                || billingMonthStartDay === null) {
            showToast(messages["settings.form.required"] ?? "Fill in required settings.", "error");
            return;
        }

        setFormDisabled(settingsForm, true);
        try {
            await ensureMessages();
            await saveSettings();
            settingsModal.close();
            showToast(messages["settings.form.success"] ?? "Settings have been saved.", "success");
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            setFormDisabled(settingsForm, false);
        }
    });

    document.querySelector("#language-select")?.addEventListener("change", async () => {
        messagesLanguage = "";
        if (!profileModal.isOpen() && !settingsModal.isOpen()) {
            return;
        }

        try {
            await ensureMessages();
        } catch (error) {
            showToast(error.message, "error");
        }
    });
})();
