const MoneySnapshotI18n = (() => {
    const DEFAULT_LANGUAGE = "pl";
    const SUPPORTED_LANGUAGES = new Set(["pl", "en"]);
    const STORAGE_KEY = "money-snapshot-language";

    function resolveInitialLanguage() {
        const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
        if (SUPPORTED_LANGUAGES.has(savedLanguage)) {
            return savedLanguage;
        }

        const browserLanguage = navigator.language?.split("-")[0];
        return SUPPORTED_LANGUAGES.has(browserLanguage) ? browserLanguage : DEFAULT_LANGUAGE;
    }

    async function loadMessages(endpoint, language) {
        const response = await fetch(`${endpoint}?lang=${encodeURIComponent(language)}`);
        if (!response.ok) {
            throw new Error(`Cannot load messages for language: ${language}`);
        }

        return response.json();
    }

    function applyMessages(messages, language, translatableNodes = document.querySelectorAll("[data-i18n], [data-i18n-title], [data-i18n-aria-label]")) {
        document.documentElement.lang = language;
        translatableNodes.forEach((node) => {
            const textKey = node.dataset.i18n;
            const titleKey = node.dataset.i18nTitle;
            const ariaLabelKey = node.dataset.i18nAriaLabel;

            if (textKey && messages[textKey]) {
                node.textContent = messages[textKey];
            }

            if (titleKey) {
                if (messages[titleKey]) {
                    node.dataset.tooltip = messages[titleKey];
                    node.classList.add("has-app-tooltip");
                    node.removeAttribute("title");
                } else {
                    delete node.dataset.tooltip;
                    node.classList.remove("has-app-tooltip");
                }
            }

            if (ariaLabelKey) {
                if (messages[ariaLabelKey]) {
                    node.setAttribute("aria-label", messages[ariaLabelKey]);
                }
            }
        });
    }

    async function init({endpoint, onLanguageChange = () => {}}) {
        const languageSelect = document.querySelector("#language-select");
        let currentLanguage = resolveInitialLanguage();
        let messages = {};

        async function setLanguage(language) {
            currentLanguage = SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
            messages = await loadMessages(endpoint, currentLanguage);
            applyMessages(messages, currentLanguage);
            window.localStorage.setItem(STORAGE_KEY, currentLanguage);

            if (languageSelect) {
                languageSelect.value = currentLanguage;
            }

            onLanguageChange({language: currentLanguage, messages});
            return {language: currentLanguage, messages};
        }

        if (languageSelect) {
            languageSelect.addEventListener("change", (event) => {
                setLanguage(event.target.value).catch((error) => {
                    console.error(error);
                });
            });
        }

        return setLanguage(currentLanguage);
    }

    return {
        init
    };
})();
