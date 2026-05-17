const tableBody = document.querySelector("#snapshots-table-body");
const refreshButton = document.querySelector("#refresh-snapshots");
const listMessage = document.querySelector("#snapshots-list-message");
const previousPageButton = document.querySelector("#snapshots-prev-page");
const nextPageButton = document.querySelector("#snapshots-next-page");
const pageInfo = document.querySelector("#snapshots-page-info");
const pageSizeSelect = document.querySelector("#snapshots-page-size");
const accountFilterSelect = document.querySelector("#snapshots-account-filter");
const deleteModal = MoneySnapshotUi.createConfirmModal({
    modalSelector: "#delete-snapshot-modal",
    subjectSelector: "#delete-snapshot-name",
    confirmSelector: "#confirm-delete-snapshot",
    cancelSelector: "#cancel-delete-snapshot"
});

let currentLanguage = "pl";
let messages = {};
let cachedSnapshots = [];
let snapshotsLoaded = false;
let currentPage = 0;
let currentPageData = null;
let cachedAccounts = [];
let userSettings = null;

function handleLanguageChange(nextLanguage, nextMessages) {
    currentLanguage = nextLanguage;
    messages = nextMessages;
    document.title = `${messages["snapshots.heading.title"]} | ${messages["app.name"]}`;
    if (snapshotsLoaded) {
        renderAccountFilterOptions();
        renderSnapshots(cachedSnapshots);
        renderPagination(currentPageData);
    }
}

function setListMessage(text, type = "") {
    listMessage.textContent = text;
    listMessage.dataset.type = type;
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

function formatAccountOption(account) {
    return `${account.accountName} (${account.bankName}, ${account.currencyCode})`;
}

function renderAccountFilterOptions() {
    const selectedValue = accountFilterSelect.value;
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

function renderSnapshots(snapshots) {
    cachedSnapshots = snapshots;
    snapshotsLoaded = true;

    if (snapshots.length === 0) {
        renderEmpty(messages["snapshots.empty"] ?? "");
        return;
    }

    tableBody.replaceChildren(...snapshots.map((snapshot) => {
        const row = document.createElement("tr");
        [
            snapshot.accountName,
            formatDate(snapshot.snapshotDate),
            formatBalance(snapshot),
            snapshot.note || "-",
            formatDateTime(snapshot.createdAt)
        ].forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
        });

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");
        actions.className = "row-actions";
        editButton.type = "button";
        editButton.className = "icon-button";
        editButton.title = messages["snapshots.actions.edit"];
        editButton.setAttribute("aria-label", messages["snapshots.actions.edit"]);
        editButton.append(MoneySnapshotUi.createEditIcon());
        editButton.addEventListener("click", () => {
            window.location.href = `/snapshots/${encodeURIComponent(snapshot.id)}/edit.html`;
        });
        deleteButton.type = "button";
        deleteButton.className = "icon-button danger";
        deleteButton.title = messages["snapshots.actions.delete"];
        deleteButton.setAttribute("aria-label", messages["snapshots.actions.delete"]);
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
    const accountFilter = accountId ? `&accountId=${encodeURIComponent(accountId)}` : "";
    const response = await fetch(`/api/snapshots?page=${encodeURIComponent(currentPage)}&size=${encodeURIComponent(pageSize)}${accountFilter}`);
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
    const response = await fetch("/api/accounts");
    if (!response.ok) {
        throw new Error(messages["snapshots.error.loadAccounts"]);
    }

    cachedAccounts = await response.json();
    renderAccountFilterOptions();
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
    setListMessage("");
    loadSnapshots().catch((error) => {
        setListMessage(error.message, "error");
    });
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
        .then(() => MoneySnapshotUi.loadUserSettings())
        .then((settings) => {
            userSettings = settings;
        })
        .then(loadAccounts)
        .then(loadSnapshots)
        .catch((error) => {
            renderEmpty(error.message);
        });
