const retirementPageForm = document.querySelector("#retirement-account-page-form");
const retirementPageMessage = document.querySelector("#retirement-account-page-message");
const retirementPageAccountId = document.body.dataset.retirementAccountId || null;
const parseRetirementAmount = value => Number(String(value || "").replace(/\s/g, "").replace(",", "."));

retirementPageForm?.elements.updatedAt && (retirementPageForm.elements.updatedAt.value = MoneySnapshotUi.localIsoDate());

function retirementPagePayload(form) {
    const balance = parseRetirementAmount(form.elements.balance.value);
    const monthlyContribution = parseRetirementAmount(form.elements.monthlyContribution.value);
    return {accountTypeCode: form.elements.type.value, institution: form.elements.institution.value.trim(), accountName: form.elements.account.value.trim(), websiteUrl: form.elements.websiteUrl.value.trim(), currencyCode: form.elements.currency.value.trim().toUpperCase(), balance, monthlyContribution, balanceUpdatedAt: form.elements.updatedAt.value, status: form.elements.statusKey.value};
}

async function loadRetirementPageAccount() {
    if (!retirementPageAccountId) return;
    const response = await fetch(`/api/retirement-accounts/${encodeURIComponent(retirementPageAccountId)}`);
    if (!response.ok) throw new Error("Unable to load the retirement account.");
    const account = await response.json();
    const form = retirementPageForm;
    form.elements.type.value = account.accountTypeCode;
    form.elements.institution.value = account.institution ?? "";
    form.elements.account.value = account.accountName ?? "";
    form.elements.websiteUrl.value = account.websiteUrl ?? "";
    form.elements.currency.value = account.currencyCode ?? "PLN";
    form.elements.balance.value = String(account.balance ?? "").replace(".", ",");
    form.elements.monthlyContribution.value = String(account.monthlyContribution ?? "").replace(".", ",");
    form.elements.updatedAt.value = account.balanceUpdatedAt ?? "";
    form.elements.statusKey.value = account.status ?? "ACTIVE";
    [form.elements.type, form.elements.statusKey].forEach((select) => window.MoneySnapshotSelect?.create(select)?.refresh());
    form.elements.currency.disabled = true;
    form.elements.balance.disabled = true;
    form.elements.updatedAt.disabled = true;
    form.querySelector("button[type=submit]").textContent = "Zapisz zmiany";
}

retirementPageForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    retirementPageMessage.textContent = "";
    const form = retirementPageForm;
    const balance = parseRetirementAmount(form.elements.balance.value);
    const monthlyContribution = parseRetirementAmount(form.elements.monthlyContribution.value);
    const currencyCode = form.elements.currency.value.trim().toUpperCase();
    if (!form.reportValidity() || !/^[A-Z]{3}$/.test(currencyCode) || !Number.isFinite(balance) || balance < 0 || !Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
        retirementPageMessage.textContent = "Invalid form values.";
        return;
    }
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
        const response = await fetch(retirementPageAccountId ? `/api/retirement-accounts/${encodeURIComponent(retirementPageAccountId)}` : "/api/retirement-accounts", {method: retirementPageAccountId ? "PUT" : "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(retirementPagePayload(form))});
        if (!response.ok) throw new Error("Unable to save the retirement account.");
        window.location.href = "/retirement.html";
    } catch (error) {
        retirementPageMessage.textContent = error.message;
        submit.disabled = false;
    }
});

MoneySnapshotI18n.init({endpoint: "/api/retirement/messages"}).then(loadRetirementPageAccount).catch((error) => { retirementPageMessage.textContent = error.message; });
