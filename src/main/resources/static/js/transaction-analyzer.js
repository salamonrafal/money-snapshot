const form = document.querySelector("#transaction-analyzer-form");
const fileInput = document.querySelector("#transaction-analyzer-file");
const fileStatus = document.querySelector("#transaction-analyzer-file-status");
const message = document.querySelector("#transaction-analyzer-message");
const bankHelpButton = document.querySelector("#transaction-analyzer-bank-help");
let messages = {};

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

form?.addEventListener("submit", (event) => {
    event.preventDefault();
    message.textContent = textFor("transactionAnalyzer.upload.mockMessage", "Analiza pliku będzie dostępna w kolejnym etapie.");
    message.dataset.type = "success";
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
