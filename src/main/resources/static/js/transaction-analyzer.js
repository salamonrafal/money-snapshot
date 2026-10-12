const form = document.querySelector("#transaction-analyzer-form");
const fileInput = document.querySelector("#transaction-analyzer-file");
const fileStatus = document.querySelector("#transaction-analyzer-file-status");
const message = document.querySelector("#transaction-analyzer-message");
const bankHelpButton = document.querySelector("#transaction-analyzer-bank-help");
const storedFiles = document.querySelector("#transaction-analyzer-files");
const storedFilesEmpty = document.querySelector("#transaction-analyzer-files-empty");
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

function renderStoredFiles(files) {
    if (!storedFiles || !storedFilesEmpty) {
        return;
    }

    storedFiles.replaceChildren();
    storedFiles.hidden = files.length === 0;
    storedFilesEmpty.hidden = files.length > 0;
    for (const file of files) {
        const item = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = file.originalFilename;
        const download = document.createElement("a");
        download.href = file.downloadUrl;
        download.className = "button secondary compact";
        download.textContent = textFor("transactionAnalyzer.files.download", "Pobierz");
        item.append(name, download);
        storedFiles.append(item);
    }
}

async function loadStoredFiles() {
    if (!storedFiles) {
        return;
    }

    const response = await fetch("/api/transaction-analyzer/uploads");
    if (!response.ok) {
        throw new Error("Could not load uploaded files");
    }
    renderStoredFiles(await response.json());
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
        if (response.status !== 201 || response.redirected) {
            throw new Error("Upload failed");
        }
        const uploadedFile = await response.json();
        if (!uploadedFile?.id || !uploadedFile?.downloadUrl) {
            throw new Error("Upload failed");
        }

        form.reset();
        renderFileStatus();
        await loadStoredFiles();
        message.textContent = textFor("transactionAnalyzer.upload.success", "Plik został przesłany. Analiza będzie dostępna w kolejnym etapie.");
        message.dataset.type = "success";
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
        loadStoredFiles().catch(console.error);
    }
}).catch((error) => {
    console.error(error);
});
