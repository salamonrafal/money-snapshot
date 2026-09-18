const retirementBalanceForm = document.querySelector("#retirement-balance-page-form");
const retirementBalanceMessage = document.querySelector("#retirement-balance-page-message");
const retirementBalanceAccountId = document.body.dataset.retirementAccountId;
const retirementBalancePrevious = document.querySelector("#retirement-balance-page-previous");
const retirementBalanceAmount = value => Number(String(value || "").replace(/\s/g, "").replace(",", "."));
let retirementBalanceAccount;

function syncRetirementBalanceNoteAvailability() {
    const note = retirementBalanceForm?.elements.note;
    if (!(note instanceof HTMLInputElement) || !retirementBalanceAccount) {
        return;
    }

    const currentBalance = retirementBalanceAmount(retirementBalanceForm.elements.currentBalance.value);
    const canSaveNote = Number.isFinite(currentBalance) && currentBalance > Number(retirementBalanceAccount.balance);
    note.disabled = !canSaveNote;
    if (!canSaveNote) {
        note.value = "";
    }
}

async function loadRetirementBalanceAccount() {
    const response = await fetch(`/api/retirement-accounts/${encodeURIComponent(retirementBalanceAccountId)}`);
    if (!response.ok) throw new Error("Unable to load the retirement account.");
    retirementBalanceAccount = await response.json();
    retirementBalancePrevious.textContent = MoneySnapshotUi.formatMoneyValue(retirementBalanceAccount.balance, {moneyFormat: "### ###,00"}) + ` ${retirementBalanceAccount.currencyCode}`;
    const date = MoneySnapshotUi.localIsoDate();
    retirementBalanceForm.elements.contributionDate.min = retirementBalanceAccount.balanceUpdatedAt;
    retirementBalanceForm.elements.contributionDate.value = date < retirementBalanceAccount.balanceUpdatedAt ? retirementBalanceAccount.balanceUpdatedAt : date;
    syncRetirementBalanceNoteAvailability();
    document.querySelector("#retirement-balance-page-subtitle").textContent = `${document.querySelector("#retirement-balance-page-subtitle").textContent} ${retirementBalanceAccount.accountName}`;
}

retirementBalanceForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentBalance = retirementBalanceAmount(retirementBalanceForm.elements.currentBalance.value);
    syncRetirementBalanceNoteAvailability();
    if (!retirementBalanceForm.reportValidity() || !Number.isFinite(currentBalance) || currentBalance < 0) {
        retirementBalanceMessage.textContent = "Invalid balance value.";
        return;
    }
    const submit = retirementBalanceForm.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
        const contribution = currentBalance > Number(retirementBalanceAccount.balance);
        const response = await fetch(contribution ? `/api/retirement-accounts/${encodeURIComponent(retirementBalanceAccountId)}/contributions` : `/api/retirement-accounts/${encodeURIComponent(retirementBalanceAccountId)}/balance`, {method: contribution ? "POST" : "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify(contribution ? {currentBalance, contributionDate: retirementBalanceForm.elements.contributionDate.value, note: retirementBalanceForm.elements.note.value.trim()} : {balance: currentBalance, balanceUpdatedAt: retirementBalanceForm.elements.contributionDate.value})});
        if (!response.ok) throw new Error("Unable to save the balance.");
        window.location.href = "/retirement.html";
    } catch (error) {
        retirementBalanceMessage.textContent = error.message;
        submit.disabled = false;
    }
});

retirementBalanceForm?.elements.currentBalance.addEventListener("input", syncRetirementBalanceNoteAvailability);

MoneySnapshotI18n.init({endpoint: "/api/retirement/messages"}).then(loadRetirementBalanceAccount).catch((error) => { retirementBalanceMessage.textContent = error.message; });
