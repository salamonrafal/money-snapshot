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

    function applyMessages(messages, language, translatableNodes = document.querySelectorAll("[data-i18n]")) {
        document.documentElement.lang = language;
        translatableNodes.forEach((node) => {
            const key = node.dataset.i18n;
            if (messages[key]) {
                node.textContent = messages[key];
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
