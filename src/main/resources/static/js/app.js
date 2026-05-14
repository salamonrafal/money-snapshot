const DEFAULT_LANGUAGE = "pl";
const SUPPORTED_LANGUAGES = new Set(["pl", "en"]);

const languageSelect = document.querySelector("#language-select");
const translatableNodes = document.querySelectorAll("[data-i18n]");

function resolveInitialLanguage() {
    const savedLanguage = window.localStorage.getItem("money-snapshot-language");
    if (SUPPORTED_LANGUAGES.has(savedLanguage)) {
        return savedLanguage;
    }

    const browserLanguage = navigator.language?.split("-")[0];
    return SUPPORTED_LANGUAGES.has(browserLanguage) ? browserLanguage : DEFAULT_LANGUAGE;
}

async function loadMessages(language) {
    const response = await fetch(`/api/home/messages?lang=${encodeURIComponent(language)}`);
    if (!response.ok) {
        throw new Error(`Cannot load messages for language: ${language}`);
    }

    return response.json();
}

function applyMessages(messages, language) {
    document.documentElement.lang = language;
    translatableNodes.forEach((node) => {
        const key = node.dataset.i18n;
        if (messages[key]) {
            node.textContent = messages[key];
        }
    });
}

async function setLanguage(language) {
    const nextLanguage = SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
    const messages = await loadMessages(nextLanguage);
    applyMessages(messages, nextLanguage);
    window.localStorage.setItem("money-snapshot-language", nextLanguage);
    languageSelect.value = nextLanguage;
}

languageSelect.addEventListener("change", (event) => {
    setLanguage(event.target.value).catch((error) => {
        console.error(error);
    });
});

setLanguage(resolveInitialLanguage()).catch((error) => {
    console.error(error);
});
