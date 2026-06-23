const counterpartiesTableBody = document.querySelector("#counterparties-table-body");
const counterpartiesListMessage = document.querySelector("#counterparties-list-message");
const refreshCounterpartiesButton = document.querySelector("#refresh-counterparties");
const newCounterpartyAction = document.querySelector("#new-counterparty-action");
const counterpartyInfoTitle = document.querySelector("#counterparty-info-title");
const counterpartyInfoList = document.querySelector("#counterparty-info-list");
const counterpartiesToastManager = MoneySnapshotUi.createToastManager({durationMs: 5000});
const COUNTERPARTIES_NOTIFICATION_KEY = "money-snapshot-counterparties-notification";
const deleteCounterpartyModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-counterparty-modal",
    subjectSelector: "#delete-counterparty-name",
    confirmSelector: "#confirm-delete-counterparty",
    cancelSelector: "#cancel-delete-counterparty"
});
const counterpartyInfoModal = MoneySnapshotUi.createModal({
    modalSelector: "#counterparty-info-modal",
    closeSelectors: ["#counterparty-info-close"]
});

let counterpartiesMessages = {};
let cachedCounterparties = [];
let counterpartiesLoaded = false;
let counterpartiesUserSettings = null;
let selectedCounterpartyForDetails = null;

function handleCounterpartiesLanguageChange(nextMessages) {
    counterpartiesMessages = nextMessages;
    document.title = `${counterpartiesMessages["counterparties.heading.title"]} | ${counterpartiesMessages["app.name"]}`;
    if (counterpartyInfoModal.isOpen()) {
        renderCounterpartyInfoModal();
    }
    if (counterpartiesLoaded) {
        renderCounterparties(cachedCounterparties);
    }
}

function showCounterpartiesToast(text, type = "") {
    if (!text) {
        return;
    }

    counterpartiesToastManager.clear();
    counterpartiesToastManager.show(text, {type});
}

function setCounterpartiesListMessage(text, type = "") {
    if (!counterpartiesListMessage) {
        return;
    }

    counterpartiesListMessage.textContent = text;
    counterpartiesListMessage.dataset.type = type;
}

function showPendingCounterpartiesNotification() {
    let rawValue = "";

    try {
        rawValue = window.sessionStorage.getItem(COUNTERPARTIES_NOTIFICATION_KEY) ?? "";
    } catch (error) {
        console.warn("Cannot access counterparties notification state", error);
        return;
    }

    if (!rawValue) {
        return;
    }

    try {
        window.sessionStorage.removeItem(COUNTERPARTIES_NOTIFICATION_KEY);
    } catch (error) {
        console.warn("Cannot clear counterparties notification state", error);
    }

    try {
        const notification = JSON.parse(rawValue);
        const messageKey = typeof notification?.messageKey === "string" ? notification.messageKey : "";
        const type = typeof notification?.type === "string" ? notification.type : "";
        const text = counterpartiesMessages[messageKey] ?? "";
        if (text) {
            showCounterpartiesToast(text, type);
        }
    } catch (error) {
        console.warn("Cannot parse counterparties notification state", error);
    }
}

function formatCounterpartyDateTime(value) {
    if (!value) {
        return "-";
    }

    return MoneySnapshotUi.formatDateTimeValue(value, counterpartiesUserSettings);
}

function formatCounterpartyBankAccountNumber(value) {
    return MoneySnapshotUi.formatBankAccountNumber(value);
}

function counterpartyDetailsValue(value) {
    if (typeof value !== "string") {
        return counterpartiesMessages["counterparties.info.notAvailable"] ?? "-";
    }

    const trimmed = value.trim();
    return trimmed || (counterpartiesMessages["counterparties.info.notAvailable"] ?? "-");
}

function renderCounterpartiesEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = message;
    row.append(cell);
    counterpartiesTableBody.replaceChildren(row);
}

function createCounterpartyInfoAction(counterparty) {
    const infoButton = document.createElement("button");
    infoButton.type = "button";
    infoButton.className = "icon-button";
    infoButton.setAttribute("aria-label", counterpartiesMessages["counterparties.actions.info"] ?? "");
    MoneySnapshotUi.setTooltip(infoButton, counterpartiesMessages["counterparties.actions.info"] ?? "");
    infoButton.append(MoneySnapshotUi.createInfoIcon());
    infoButton.addEventListener("click", () => {
        openCounterpartyInfoModal(counterparty, infoButton);
    });
    return infoButton;
}

function createCounterpartyEditAction(counterparty) {
    const editLink = document.createElement("a");
    editLink.className = "icon-button";
    editLink.href = `/counterparties/${encodeURIComponent(counterparty.id)}/edit.html`;
    editLink.setAttribute("aria-label", counterpartiesMessages["counterparties.actions.edit"] ?? "");
    MoneySnapshotUi.setTooltip(editLink, counterpartiesMessages["counterparties.actions.edit"] ?? "");
    editLink.append(MoneySnapshotUi.createEditIcon());
    return editLink;
}

function createCounterpartyDeleteAction(counterparty) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button danger";
    deleteButton.setAttribute("aria-label", counterpartiesMessages["counterparties.actions.delete"] ?? "");
    MoneySnapshotUi.setTooltip(deleteButton, counterpartiesMessages["counterparties.actions.delete"] ?? "");
    deleteButton.append(MoneySnapshotUi.createTrashIcon());
    deleteButton.addEventListener("click", () => {
        deleteCounterpartyModal.open(counterparty, counterparty.name ?? "");
    });
    return deleteButton;
}

function buildCounterpartyInfoFields(counterparty) {
    const bankName = MoneySnapshotUi.resolvePolishBankNameFromAccountNumber(counterparty.bankAccountNumber);

    return [
        {label: counterpartiesMessages["counterparties.table.name"] ?? "", value: counterpartyDetailsValue(counterparty.name)},
        {
            label: counterpartiesMessages["counterparties.table.bankAccountNumber"] ?? "",
            value: formatCounterpartyBankAccountNumber(counterparty.bankAccountNumber),
            helper: `${counterpartiesMessages["counterpartyForm.form.bankNameHint"] ?? ""} ${bankName || (counterpartiesMessages["counterpartyForm.form.bankNameUnknown"] ?? "")}`
        },
        {label: counterpartiesMessages["counterparties.table.normalizedName"] ?? "", value: counterpartyDetailsValue(counterparty.normalizedName)},
        {label: counterpartiesMessages["counterpartyForm.form.address"] ?? "", value: counterpartyDetailsValue(counterparty.address)},
        {label: counterpartiesMessages["counterpartyForm.form.note"] ?? "", value: counterpartyDetailsValue(counterparty.note)},
        {label: counterpartiesMessages["counterparties.info.createdAt"] ?? "", value: formatCounterpartyDateTime(counterparty.createdAt)},
        {label: counterpartiesMessages["counterparties.info.updatedAt"] ?? "", value: formatCounterpartyDateTime(counterparty.updatedAt)}
    ];
}

function renderCounterpartyInfoModal() {
    if (!selectedCounterpartyForDetails || !counterpartyInfoTitle || !counterpartyInfoList) {
        return;
    }

    counterpartyInfoTitle.textContent = counterpartiesMessages["counterparties.info.title"] ?? "";
    counterpartyInfoList.replaceChildren(...buildCounterpartyInfoFields(selectedCounterpartyForDetails).flatMap(({label, value, helper}) => {
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.textContent = label;
        if (helper) {
            const primary = document.createElement("span");
            const secondary = document.createElement("small");
            primary.textContent = value;
            secondary.className = "info-list-helper";
            secondary.textContent = helper;
            detail.append(primary, secondary);
        } else {
            detail.textContent = value;
        }
        return [term, detail];
    }));
}

function openCounterpartyInfoModal(counterparty, trigger) {
    selectedCounterpartyForDetails = counterparty;
    renderCounterpartyInfoModal();
    counterpartyInfoModal.open({trigger});
}

function createCounterpartyRow(counterparty) {
    const row = document.createElement("tr");

    [
        counterparty.name ?? "-",
        formatCounterpartyBankAccountNumber(counterparty.bankAccountNumber),
        counterparty.normalizedName ?? "-",
        formatCounterpartyDateTime(counterparty.updatedAt)
    ].forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 1) {
            cell.className = "counterparty-bank-account";
        }
        row.append(cell);
    });

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(
        createCounterpartyInfoAction(counterparty),
        createCounterpartyEditAction(counterparty),
        createCounterpartyDeleteAction(counterparty)
    );
    actionsCell.append(actions);
    row.append(actionsCell);

    return row;
}

function renderCounterparties(counterparties) {
    cachedCounterparties = counterparties;
    counterpartiesLoaded = true;

    if (counterparties.length === 0) {
        renderCounterpartiesEmpty(counterpartiesMessages["counterparties.empty"] ?? "");
        return;
    }

    counterpartiesTableBody.replaceChildren(...counterparties.map(createCounterpartyRow));
}

async function loadCounterparties() {
    const response = await fetch("/api/counterparties");
    if (!response.ok) {
        throw new Error(counterpartiesMessages["counterparties.error.load"] ?? "");
    }

    return response.json();
}

async function deleteCounterparty(id) {
    const response = await fetch(`/api/counterparties/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
    let errorPayload = null;
    if (!response.ok && (response.headers.get("content-type") ?? "").includes("application/json")) {
        try {
            errorPayload = await response.json();
        } catch (error) {
            errorPayload = null;
        }
    }

    if (response.status === 404) {
        throw new Error(errorPayload?.message ?? counterpartiesMessages["counterparties.error.notFound"] ?? "");
    }

    if (response.status === 409) {
        throw new Error(counterpartiesMessages["counterparties.error.inUse"] ?? "");
    }

    if (!response.ok) {
        throw new Error(errorPayload?.message ?? counterpartiesMessages["counterparties.error.delete"] ?? "");
    }
}

async function refreshCounterparties() {
    setCounterpartiesListMessage("", "");
    renderCounterpartiesEmpty(counterpartiesMessages["counterparties.loading"] ?? "");
    refreshCounterpartiesButton.disabled = true;
    try {
        const [settings, counterparties] = await Promise.all([
            MoneySnapshotUi.loadUserSettings(),
            loadCounterparties()
        ]);
        counterpartiesUserSettings = settings;
        renderCounterparties(counterparties);
        showPendingCounterpartiesNotification();
    } catch (error) {
        renderCounterpartiesEmpty(counterpartiesMessages["counterparties.error.load"] ?? "");
        setCounterpartiesListMessage(error.message, "error");
    } finally {
        refreshCounterpartiesButton.disabled = false;
    }
}

refreshCounterpartiesButton?.addEventListener("click", () => {
    void refreshCounterparties();
});

deleteCounterpartyModal.confirmButton?.addEventListener("click", async () => {
    const selectedCounterparty = deleteCounterpartyModal.getSelectedItem();
    if (!selectedCounterparty) {
        return;
    }

    deleteCounterpartyModal.confirmButton.disabled = true;
    setCounterpartiesListMessage("", "");

    try {
        await deleteCounterparty(selectedCounterparty.id);
        if (selectedCounterpartyForDetails?.id === selectedCounterparty.id) {
            selectedCounterpartyForDetails = null;
            counterpartyInfoModal.close();
        }
        deleteCounterpartyModal.close();
        await refreshCounterparties();
        showCounterpartiesToast(counterpartiesMessages["counterparties.delete.success"] ?? "", "success");
    } catch (error) {
        deleteCounterpartyModal.close();
        showCounterpartiesToast(error.message, "error");
    } finally {
        deleteCounterpartyModal.confirmButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/counterparties/messages",
    onLanguageChange: ({messages}) => {
        handleCounterpartiesLanguageChange(messages);
        if (newCounterpartyAction) {
            MoneySnapshotUi.setTooltip(newCounterpartyAction, messages["counterparties.actions.add"] ?? "");
        }
        if (refreshCounterpartiesButton) {
            MoneySnapshotUi.setTooltip(refreshCounterpartiesButton, messages["counterparties.actions.refresh"] ?? "");
        }
        void refreshCounterparties();
    }
}).catch((error) => {
    console.error(error);
});
