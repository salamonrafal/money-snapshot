const tableBody = document.querySelector("#snapshots-table-body");
const refreshButton = document.querySelector("#refresh-snapshots");
const newSnapshotAction = document.querySelector("#new-snapshot-action");
const newBulkSnapshotsAction = document.querySelector("#new-bulk-snapshots-action");
const listMessage = document.querySelector("#snapshots-list-message");
const previousPageButton = document.querySelector("#snapshots-prev-page");
const nextPageButton = document.querySelector("#snapshots-next-page");
const pageInfo = document.querySelector("#snapshots-page-info");
const pageSizeSelect = document.querySelector("#snapshots-page-size");
const accountFilterSelect = document.querySelector("#snapshots-account-filter");
const dateFilterInput = document.querySelector("#snapshots-date-filter");
const clearFiltersButton = document.querySelector("#clear-snapshots-filters");
const snapshotFormModalElement = document.querySelector("#snapshot-form-modal");
const bulkSnapshotFormModalElement = document.querySelector("#bulk-snapshot-form-modal");
const snapshotFormModal = snapshotFormModalElement
    ? MoneySnapshotUi.createModal({
        modalSelector: "#snapshot-form-modal",
        closeSelectors: ["#snapshot-form-modal [data-snapshot-modal-close]"]
    })
    : null;
const bulkSnapshotFormModal = bulkSnapshotFormModalElement
    ? MoneySnapshotUi.createModal({
        modalSelector: "#bulk-snapshot-form-modal",
        closeSelectors: ["#bulk-snapshot-form-modal [data-bulk-snapshot-modal-close]"]
    })
    : null;
const snapshotFormElement = snapshotFormModalElement?.querySelector("[data-snapshot-form]") ?? null;
const bulkSnapshotFormElement = bulkSnapshotFormModalElement?.querySelector("[data-bulk-snapshot-form]") ?? null;
const editSnapshotFormModalElement = document.querySelector("#edit-snapshot-form-modal");
const editSnapshotFormModal = editSnapshotFormModalElement
    ? MoneySnapshotUi.createModal({
        modalSelector: "#edit-snapshot-form-modal",
        closeSelectors: ["#edit-snapshot-form-modal [data-snapshot-modal-close]"]
    })
    : null;
const editSnapshotFormElement = editSnapshotFormModalElement?.querySelector("[data-snapshot-form]") ?? null;
const SNAPSHOT_LIST_STATE_KEY = "money-snapshot-snapshots-list-state";
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-snapshot-modal",
    subjectSelector: "#delete-snapshot-name",
    confirmSelector: "#confirm-delete-snapshot",
    cancelSelector: "#cancel-delete-snapshot"
});
const toastManager = MoneySnapshotUi.createToastManager({
    durationMs: 5000
});

let currentLanguage = "pl";
let messages = {};
let cachedSnapshots = [];
let snapshotsLoaded = false;
let currentPage = 0;
let currentPageData = null;
let cachedAccounts = [];
let userSettings = null;
let snapshotFormController = null;
let editSnapshotFormController = null;
let bulkSnapshotFormController = null;
let snapshotFormControllerPromise = null;
let editSnapshotFormControllerPromise = null;
let bulkSnapshotFormControllerPromise = null;

if (clearFiltersButton) {
    clearFiltersButton.append(MoneySnapshotUi.createClearFiltersIcon());
}

listMessage?.classList.add("visually-hidden");

function saveListState() {
    try {
        window.sessionStorage.setItem(SNAPSHOT_LIST_STATE_KEY, JSON.stringify({
            currentPage,
            pageSize: pageSizeSelect.value,
            accountId: accountFilterSelect.value,
            snapshotDate: dateFilterInput.value
        }));
    } catch (error) {
        console.warn("Cannot save snapshots list state", error);
    }
}

function restoreListState() {
    let savedState;
    try {
        savedState = window.sessionStorage.getItem(SNAPSHOT_LIST_STATE_KEY);
    } catch (error) {
        console.warn("Cannot access snapshots list state", error);
        return;
    }

    if (!savedState) {
        return;
    }

    try {
        const state = JSON.parse(savedState);
        currentPage = Number.isInteger(state.currentPage) && state.currentPage >= 0 ? state.currentPage : 0;
        pageSizeSelect.value = ["10", "20", "50", "100"].includes(state.pageSize) ? state.pageSize : pageSizeSelect.value;
        dateFilterInput.value = typeof state.snapshotDate === "string" ? state.snapshotDate : "";
        accountFilterSelect.dataset.pendingValue = typeof state.accountId === "string" ? state.accountId : "";
    } catch (error) {
        console.error("Cannot restore snapshots list state", error);
        try {
            window.sessionStorage.removeItem(SNAPSHOT_LIST_STATE_KEY);
        } catch (removeError) {
            console.warn("Cannot clear invalid snapshots list state", removeError);
        }
    }
}

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    document.title = `${messages["snapshots.heading.title"]} | ${messages["app.name"]}`;
    MoneySnapshotUi.setTooltip(newSnapshotAction, messages["snapshots.actions.add"]);
    MoneySnapshotUi.setTooltip(newBulkSnapshotsAction, messages["snapshots.actions.addBulk"]);
    MoneySnapshotUi.setTooltip(refreshButton, messages["snapshots.actions.refresh"]);
    updateClearFiltersButton();
    if (snapshotsLoaded) {
        renderAccountFilterOptions();
        renderSnapshots(cachedSnapshots);
        renderPagination(currentPageData);
    }
    snapshotFormController?.handleLanguageChange(messages);
    editSnapshotFormController?.handleLanguageChange(messages);
    bulkSnapshotFormController?.handleLanguageChange(messages);
}

function setListMessage(text, type = "") {
    if (listMessage) {
        listMessage.textContent = text;
        listMessage.dataset.type = type;
    }

    if (!text) {
        toastManager.clear();
        return;
    }

    toastManager.show(text, {
        type
    });
}

function hasActiveFilters() {
    return Boolean(accountFilterSelect.value || dateFilterInput.value);
}

function updateClearFiltersButton() {
    if (!clearFiltersButton) {
        return;
    }

    const clearFiltersLabel = messages["snapshots.filter.clear"];
    if (clearFiltersLabel) {
        MoneySnapshotUi.setTooltip(clearFiltersButton, clearFiltersLabel);
        clearFiltersButton.setAttribute("aria-label", clearFiltersLabel);
    }

    clearFiltersButton.hidden = !hasActiveFilters();
}

function showBulkSnapshotSuccessMessage() {
    let savedCount;
    try {
        savedCount = window.sessionStorage.getItem(MoneySnapshotUi.bulkSnapshotSuccessKey);
    } catch (error) {
        console.warn("Cannot access bulk snapshot success state", error);
        return;
    }

    if (!savedCount) {
        return;
    }

    try {
        window.sessionStorage.removeItem(MoneySnapshotUi.bulkSnapshotSuccessKey);
    } catch (error) {
        console.warn("Cannot clear bulk snapshot success state", error);
    }
    const successMessage = messages["snapshots.bulk.success"] ?? "Saved snapshots: {count}.";
    setListMessage(successMessage.replace("{count}", savedCount), "success");
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return MoneySnapshotUi.formatDateValue(value, userSettings);
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    return MoneySnapshotUi.formatDateTimeValue(value, userSettings);
}

function formatBalance(snapshot) {
    return MoneySnapshotUi.formatMoneyValue(snapshot.balance, userSettings);
}

function createSnapshotTypeSelect(snapshot) {
    const select = document.createElement("select");
    select.className = "table-input snapshot-type-select";
    select.setAttribute("aria-label", messages["snapshots.table.type"] ?? "Type");

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = messages["snapshots.form.typePlaceholder"] ?? "";
    placeholder.disabled = true;
    select.append(placeholder);

    ["FINAL", "PARTIAL"].forEach((type) => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = messages[`snapshots.type.${type}`] ?? type;
        select.append(option);
    });

    select.value = snapshot.snapshotType ?? "";
    select.addEventListener("change", async () => {
        const previousType = snapshot.snapshotType;
        const nextType = select.value;
        if (nextType === previousType) {
            return;
        }

        select.disabled = true;
        setListMessage("");

        try {
            const updatedSnapshot = await updateSnapshotType(snapshot, nextType);
            snapshot.snapshotType = updatedSnapshot.snapshotType;
            select.value = updatedSnapshot.snapshotType ?? "";
            setListMessage(messages["snapshots.update.success"] ?? "", "success");
        } catch (error) {
            select.value = previousType ?? "";
            setListMessage(error.message, "error");
        } finally {
            select.disabled = false;
        }
    });

    return select;
}

function formatAccountOption(account) {
    return `${account.accountName} (${account.bankName}, ${account.currencyCode})`;
}

function renderAccountFilterOptions() {
    const selectedValue = accountFilterSelect.dataset.pendingValue || accountFilterSelect.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = messages["snapshots.filter.allAccounts"] ?? "";

    accountFilterSelect.replaceChildren(
            placeholder,
            ...cachedAccounts.map((account) => {
                const option = document.createElement("option");
                option.value = account.id;
                option.textContent = formatAccountOption(account);
                return option;
            })
    );

    accountFilterSelect.value = cachedAccounts.some((account) => account.id === selectedValue) ? selectedValue : "";
    delete accountFilterSelect.dataset.pendingValue;
    updateClearFiltersButton();
}

function renderEmpty(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
}

function snapshotSubject(snapshot) {
    return `${snapshot.accountName} - ${formatDate(snapshot.snapshotDate)}`;
}

async function ensureSnapshotFormController() {
    if (snapshotFormController) {
        return snapshotFormController;
    }

    if (snapshotFormControllerPromise) {
        return snapshotFormControllerPromise;
    }

    if (!snapshotFormElement || !window.MoneySnapshotSnapshotForm) {
        return null;
    }

    snapshotFormControllerPromise = window.MoneySnapshotSnapshotForm.init({
        root: snapshotFormElement,
        messages,
        userSettings,
        onSuccess: async ({rememberAccountEnabled, resetForm, setFormMessage}) => {
            resetForm();
            await loadSnapshots();
            if (!rememberAccountEnabled) {
                snapshotFormModal?.close();
                return true;
            }

            setFormMessage(messages["snapshots.form.success"] ?? "", "success");
            window.requestAnimationFrame(() => {
                snapshotFormController?.focus();
            });
            return true;
        }
    })
            .then((controller) => {
                snapshotFormController = controller;
                return controller;
            })
            .catch((error) => {
                snapshotFormControllerPromise = null;
                throw error;
            });

    return snapshotFormControllerPromise;
}

async function ensureEditSnapshotFormController() {
    if (editSnapshotFormController) {
        return editSnapshotFormController;
    }

    if (editSnapshotFormControllerPromise) {
        return editSnapshotFormControllerPromise;
    }

    if (!editSnapshotFormElement || !window.MoneySnapshotSnapshotForm) {
        return null;
    }

    editSnapshotFormControllerPromise = window.MoneySnapshotSnapshotForm.init({
        root: editSnapshotFormElement,
        messages,
        userSettings,
        onSuccess: async () => {
            editSnapshotFormModal?.close();
            setListMessage(messages["snapshots.edit.success"] ?? "", "success");
            await loadSnapshots();
            return true;
        }
    })
            .then((controller) => {
                editSnapshotFormController = controller;
                return controller;
            })
            .catch((error) => {
                editSnapshotFormControllerPromise = null;
                throw error;
            });

    return editSnapshotFormControllerPromise;
}

async function ensureBulkSnapshotFormController() {
    if (bulkSnapshotFormController) {
        return bulkSnapshotFormController;
    }

    if (bulkSnapshotFormControllerPromise) {
        return bulkSnapshotFormControllerPromise;
    }

    if (!bulkSnapshotFormElement || !window.MoneySnapshotBulkSnapshotForm) {
        return null;
    }

    bulkSnapshotFormControllerPromise = window.MoneySnapshotBulkSnapshotForm.init({
        root: bulkSnapshotFormElement,
        messages,
        userSettings,
        autoPrepare: false,
        redirectOnSuccess: false,
        onSuccess: async ({savedSnapshots, controller}) => {
            controller.resetForm();
            bulkSnapshotFormModal?.close();
            const successMessageTemplate = messages["snapshots.bulk.success"] ?? "";
            setListMessage(successMessageTemplate.replace("{count}", String(savedSnapshots.length)), "success");
            await loadSnapshots();
        }
    })
        .then((controller) => {
            bulkSnapshotFormController = controller;
            return controller;
        })
        .catch((error) => {
            bulkSnapshotFormControllerPromise = null;
            throw error;
        });

    return bulkSnapshotFormControllerPromise;
}

async function openEditSnapshotModal(snapshot, trigger) {
    const editSnapshotHref = `/snapshots/${encodeURIComponent(snapshot.id)}/edit.html`;
    if (!editSnapshotFormModal || !editSnapshotFormElement || !window.MoneySnapshotSnapshotForm) {
        window.location.href = editSnapshotHref;
        return;
    }

    let controller;
    try {
        controller = await ensureEditSnapshotFormController();
    } catch (error) {
        console.error(error);
        window.location.href = editSnapshotHref;
        return;
    }

    if (!controller) {
        window.location.href = editSnapshotHref;
        return;
    }

    controller.clearMessage();
    editSnapshotFormModal.open({
        trigger
    });

    try {
        await controller.loadSnapshotIntoForm(snapshot.id);
        window.requestAnimationFrame(() => {
            controller.focus();
        });
    } catch (error) {
        await controller.loadSnapshotIntoForm("");
        controller.showMessage(error?.message ?? messages["snapshots.error.loadSnapshot"] ?? "", "error");
    }
}

function renderSnapshots(snapshots) {
    cachedSnapshots = snapshots;
    snapshotsLoaded = true;

    if (snapshots.length === 0) {
        renderEmpty(messages["snapshots.empty"] ?? "");
        return;
    }

    tableBody.replaceChildren(...snapshots.map((snapshot) => {
        const row = document.createElement("tr");
        const accountCell = document.createElement("td");
        accountCell.textContent = snapshot.accountName;
        row.append(accountCell);

        const dateCell = document.createElement("td");
        dateCell.textContent = formatDate(snapshot.snapshotDate);
        row.append(dateCell);

        const balanceCell = document.createElement("td");
        balanceCell.textContent = formatBalance(snapshot);
        row.append(balanceCell);

        const typeCell = document.createElement("td");
        typeCell.append(createSnapshotTypeSelect(snapshot));
        row.append(typeCell);

        const createdAtCell = document.createElement("td");
        createdAtCell.textContent = formatDateTime(snapshot.createdAt);
        row.append(createdAtCell);

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");
        actions.className = "row-actions";
        editButton.type = "button";
        editButton.className = "icon-button";
        editButton.setAttribute("aria-label", messages["snapshots.actions.edit"]);
        MoneySnapshotUi.setTooltip(editButton, messages["snapshots.actions.edit"]);
        editButton.append(MoneySnapshotUi.createEditIcon());
        editButton.addEventListener("click", () => {
            openEditSnapshotModal(snapshot, editButton).catch((error) => {
                setListMessage(error.message, "error");
            });
        });
        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.setAttribute("aria-label", messages["snapshots.actions.delete"]);
        MoneySnapshotUi.setTooltip(deleteButton, messages["snapshots.actions.delete"]);
        deleteButton.append(MoneySnapshotUi.createTrashIcon());
        deleteButton.addEventListener("click", () => {
            deleteModal.open(snapshot, snapshotSubject(snapshot));
        });
        actions.append(editButton, deleteButton);
        actionsCell.append(actions);
        row.append(actionsCell);

        return row;
    }));
}

function renderPagination(pageData) {
    currentPageData = pageData;
    if (!pageData) {
        pageInfo.textContent = "-";
        previousPageButton.disabled = true;
        nextPageButton.disabled = true;
        return;
    }

    const totalPages = pageData.totalPages || 1;
    const pageNumber = pageData.totalElements === 0 ? 0 : pageData.page + 1;
    const template = messages["snapshots.pagination.info"] ?? "";
    pageInfo.textContent = template
            .replace("{page}", pageNumber)
            .replace("{totalPages}", totalPages)
            .replace("{totalElements}", pageData.totalElements);
    previousPageButton.disabled = pageData.first || pageData.totalElements === 0;
    nextPageButton.disabled = pageData.last || pageData.totalElements === 0;
}

async function loadSnapshots() {
    const pageSize = Number(pageSizeSelect.value);
    const accountId = accountFilterSelect.value;
    const snapshotDate = dateFilterInput.value;
    updateClearFiltersButton();
    saveListState();
    const accountFilter = accountId ? `&accountId=${encodeURIComponent(accountId)}` : "";
    const dateFilter = snapshotDate ? `&snapshotDate=${encodeURIComponent(snapshotDate)}` : "";
    const response = await fetch(`/api/snapshots?page=${encodeURIComponent(currentPage)}&size=${encodeURIComponent(pageSize)}${accountFilter}${dateFilter}`);
    if (!response.ok) {
        throw new Error(messages["snapshots.error.load"]);
    }

    const pageData = await response.json();
    if (pageData.totalPages > 0 && currentPage >= pageData.totalPages) {
        currentPage = pageData.totalPages - 1;
        return loadSnapshots();
    }

    renderSnapshots(pageData.content);
    renderPagination(pageData);
}

async function loadAccounts() {
    const response = await fetch("/api/accounts/snapshots");
    if (!response.ok) {
        throw new Error(messages["snapshots.error.loadAccounts"]);
    }

    cachedAccounts = await response.json();
    renderAccountFilterOptions();
}

async function updateSnapshotType(snapshot, snapshotType) {
    const response = await fetch(`/api/snapshots/${encodeURIComponent(snapshot.id)}/type`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            snapshotType
        })
    });

    if (!response.ok) {
        let errorMessage = messages["snapshots.error.update"];

        try {
            const errorBody = await response.json();
            if (errorBody?.message) {
                errorMessage = errorBody.message;
            }
        } catch (error) {
            console.error("Cannot parse snapshot update error", error);
        }

        throw new Error(errorMessage);
    }

    return response.json();
}

async function deleteSnapshot(id) {
    const response = await fetch(`/api/snapshots/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });

    if (response.status === 404) {
        throw new Error(messages["snapshots.error.notFound"]);
    }

    if (!response.ok) {
        throw new Error(messages["snapshots.error.delete"]);
    }
}

refreshButton.addEventListener("click", () => {
    setListMessage("");
    loadSnapshots().catch((error) => {
        setListMessage(error.message, "error");
    });
});

previousPageButton.addEventListener("click", () => {
    if (currentPage === 0) {
        return;
    }

    currentPage -= 1;
    setListMessage("");
    loadSnapshots().catch((error) => {
        setListMessage(error.message, "error");
    });
});

nextPageButton.addEventListener("click", () => {
    currentPage += 1;
    setListMessage("");
    loadSnapshots().catch((error) => {
        currentPage = Math.max(0, currentPage - 1);
        setListMessage(error.message, "error");
    });
});

pageSizeSelect.addEventListener("change", () => {
    currentPage = 0;
    setListMessage("");
    loadSnapshots().catch((error) => {
        setListMessage(error.message, "error");
    });
});

accountFilterSelect.addEventListener("change", () => {
    currentPage = 0;
    updateClearFiltersButton();
    setListMessage("");
    loadSnapshots().catch((error) => {
        setListMessage(error.message, "error");
    });
});

dateFilterInput.addEventListener("change", () => {
    currentPage = 0;
    updateClearFiltersButton();
    setListMessage("");
    loadSnapshots().catch((error) => {
        setListMessage(error.message, "error");
    });
});

clearFiltersButton?.addEventListener("click", () => {
    if (!hasActiveFilters()) {
        return;
    }

    accountFilterSelect.value = "";
    dateFilterInput.value = "";
    currentPage = 0;
    updateClearFiltersButton();
    setListMessage("");
    loadSnapshots().catch((error) => {
        setListMessage(error.message, "error");
    });
});

newSnapshotAction?.addEventListener("click", async (event) => {
    if (!snapshotFormModal || !snapshotFormElement || !window.MoneySnapshotSnapshotForm) {
        return;
    }

    event.preventDefault();

    try {
        const controller = await ensureSnapshotFormController();
        if (!controller) {
            window.location.href = newSnapshotAction.href;
            return;
        }

        controller.resetForm();
        controller.clearMessage();
        snapshotFormModal.open({
            trigger: newSnapshotAction
        });
        window.requestAnimationFrame(() => {
            controller.focus();
        });
    } catch (error) {
        setListMessage(error.message, "error");
        window.location.href = newSnapshotAction.href;
    }
});

newBulkSnapshotsAction?.addEventListener("click", async (event) => {
    if (!bulkSnapshotFormModal || !bulkSnapshotFormElement || !window.MoneySnapshotBulkSnapshotForm) {
        return;
    }

    event.preventDefault();

    try {
        const controller = await ensureBulkSnapshotFormController();
        if (!controller) {
            window.location.href = newBulkSnapshotsAction.href;
            return;
        }

        await controller.prepare({forceReload: true});
        controller.resetForm();
        controller.clearMessage();
        bulkSnapshotFormModal.open({
            trigger: newBulkSnapshotsAction
        });
        window.requestAnimationFrame(() => {
            controller.focus();
        });
    } catch (error) {
        setListMessage(error.message, "error");
        window.location.href = newBulkSnapshotsAction.href;
    }
});

deleteModal.confirmButton.addEventListener("click", async () => {
    const selectedSnapshot = deleteModal.getSelectedItem();
    if (!selectedSnapshot) {
        return;
    }

    deleteModal.confirmButton.disabled = true;
    setListMessage("");

    try {
        await deleteSnapshot(selectedSnapshot.id);
        deleteModal.close();
        setListMessage(messages["snapshots.delete.success"], "success");
        await loadSnapshots();
    } catch (error) {
        deleteModal.close();
        setListMessage(error.message, "error");
    } finally {
        deleteModal.confirmButton.disabled = false;
    }
});

MoneySnapshotI18n.init({
    endpoint: "/api/snapshots/messages",
    onLanguageChange: ({language, messages}) => {
        handleLanguageChange(language, messages);
    }
})
        .then(restoreListState)
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
            snapshotFormController?.updateUserSettings(settings);
            editSnapshotFormController?.updateUserSettings(settings);
            bulkSnapshotFormController?.updateUserSettings(settings);
        })
        .then(updateClearFiltersButton)
        .then(showBulkSnapshotSuccessMessage)
        .then(loadAccounts)
        .then(loadSnapshots)
        .catch((error) => {
            renderEmpty(error.message);
        });
