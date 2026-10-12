const form = document.querySelector("#transaction-analyzer-form");
const fileInput = document.querySelector("#transaction-analyzer-file");
const fileStatus = document.querySelector("#transaction-analyzer-file-status");
const message = document.querySelector("#transaction-analyzer-message");
const bankHelpButton = document.querySelector("#transaction-analyzer-bank-help");
let messages = {};
const transactionAnalysisStorageKey = "transaction-analyzer-result";

async function storeAnalysisForCurrentUser(analysis) {
    const response = await fetch("/api/users/me");
    if (!response.ok) {
        throw new Error("Could not identify current user");
    }
    const user = await response.json();
    sessionStorage.setItem(transactionAnalysisStorageKey, JSON.stringify({ownerId: user.id, analysis}));
}

function textFor(key, fallback) {
    return messages[key] ?? fallback;
}

function updateBankHelpTooltip() {
    MoneySnapshotUi.setTooltip(bankHelpButton, textFor(
        "transactionAnalyzer.bank.help",
        "Wybór banku pozwoli dobrać właściwy schemat pliku."
    ));
}

function renderFileStatus() {
    const [file] = fileInput?.files ?? [];
    fileStatus.textContent = file
        ? textFor("transactionAnalyzer.upload.selectedFile", "Wybrany plik: {fileName}").replace("{fileName}", file.name)
        : textFor("transactionAnalyzer.upload.noFile", "Nie wybrano pliku.");
}

fileInput?.addEventListener("change", () => {
    renderFileStatus();
    message.textContent = "";
    delete message.dataset.type;
});

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
        return;
    }

    try {
        const response = await fetch(form.action, {
            method: form.method,
            body: new FormData(form)
        });
        if (!response.ok || response.redirected) {
            throw new Error("Analysis failed");
        }
        await storeAnalysisForCurrentUser(await response.json());
        window.location.assign("/transaction-analyzer/results.html");
    } catch (error) {
        console.error(error);
        message.textContent = textFor("transactionAnalyzer.upload.error", "Nie udało się przesłać pliku. Spróbuj ponownie.");
        message.dataset.type = "error";
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/transaction-analyzer/messages",
    onLanguageChange: ({messages: nextMessages}) => {
        messages = nextMessages;
        updateBankHelpTooltip();
        renderFileStatus();
    }
}).catch((error) => {
    console.error(error);
});
