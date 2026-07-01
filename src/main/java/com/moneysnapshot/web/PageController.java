package com.moneysnapshot.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class PageController {

    private final boolean rememberMeEnabled;

    public PageController(@Value("${app.security.remember-me-key:${REMEMBER_ME_KEY:}}") String rememberMeKey) {
        this.rememberMeEnabled = rememberMeKey != null && !rememberMeKey.isBlank();
    }

    @GetMapping("/")
    public String home() {
        return "index";
    }

    @GetMapping("/login")
    public String login(Model model) {
        model.addAttribute("rememberMeEnabled", rememberMeEnabled);
        return "login";
    }

    @GetMapping("/banks.html")
    public String banks() {
        return "banks";
    }

    @GetMapping("/banks/new.html")
    public String newBank() {
        return "bank-new";
    }

    @GetMapping("/banks/{id}/edit.html")
    public String editBank(@PathVariable String id, Model model) {
        model.addAttribute("bankId", id);
        return "bank-edit";
    }

    @GetMapping("/accounts.html")
    public String accounts() {
        return "accounts";
    }

    @GetMapping("/banks-accounts.html")
    public String banksAndAccounts() {
        return "banks-accounts";
    }

    @GetMapping("/reports.html")
    public String reports() {
        return "reports";
    }

    @GetMapping("/calendar.html")
    public String calendar() {
        return "calendar";
    }

    @GetMapping("/counterparties.html")
    public String counterparties() {
        return "counterparties";
    }

    @GetMapping("/counterparties/new.html")
    public String newCounterparty() {
        return "counterparty-form";
    }

    @GetMapping("/counterparties/{id}/edit.html")
    public String editCounterparty(@PathVariable String id, Model model) {
        model.addAttribute("counterpartyId", id);
        return "counterparty-form";
    }

    @GetMapping("/bills.html")
    public String bills() {
        return "bills";
    }

    @GetMapping("/bills/new.html")
    public String newBill() {
        return "bill-form";
    }

    @GetMapping("/bills/{id}/schedule.html")
    public String billSchedule(@PathVariable String id, Model model) {
        model.addAttribute("billId", id);
        return "bill-schedule";
    }

    @GetMapping("/liabilities.html")
    public String liabilities() {
        return "liabilities";
    }

    @GetMapping("/liabilities/new.html")
    public String newLiability() {
        return "liability-new";
    }

    @GetMapping("/liabilities/{id}/edit.html")
    public String editLiability(@PathVariable String id, Model model) {
        model.addAttribute("liabilityId", id);
        return "liability-edit";
    }

    @GetMapping("/liabilities/repayments/new.html")
    public String newLiabilityRepayment() {
        return "liability-repayment-new";
    }

    @GetMapping("/liabilities/repayments/{id}/edit.html")
    public String editLiabilityRepayment(@PathVariable String id, Model model) {
        model.addAttribute("repaymentId", id);
        return "liability-repayment-edit";
    }

    @GetMapping("/savings-planning.html")
    public String savingsPlanning() {
        return "savings-planning";
    }

    @GetMapping("/savings-planning/settings.html")
    public String savingsPlanningSettings() {
        return "savings-planning-settings";
    }

    @GetMapping("/savings-planning/forecasts/new.html")
    public String savingsPlanningForecastGenerator() {
        return "savings-planning-forecast-generator";
    }

    @GetMapping("/users.html")
    public String users() {
        return "users";
    }

    @GetMapping("/users/new.html")
    public String newUser() {
        return "user-form";
    }

    @GetMapping("/users/{id}/edit.html")
    public String editUser(@PathVariable String id, Model model) {
        model.addAttribute("userId", id);
        return "user-form";
    }

    @GetMapping("/profile.html")
    public String profile() {
        return "profile";
    }

    @GetMapping("/settings.html")
    public String settings() {
        return "settings";
    }

    @GetMapping("/accounts/new.html")
    public String newAccount() {
        return "account-new";
    }

    @GetMapping("/accounts/{id}/edit.html")
    public String editAccount(@PathVariable String id, Model model) {
        model.addAttribute("accountId", id);
        return "account-edit";
    }

    @GetMapping("/snapshots/new.html")
    public String newSnapshot() {
        return "snapshot-new";
    }

    @GetMapping("/snapshots/bulk.html")
    public String newBulkSnapshots() {
        return "snapshot-bulk";
    }

    @GetMapping("/snapshots.html")
    public String snapshots() {
        return "snapshots";
    }

    @GetMapping("/snapshots/{id}/edit.html")
    public String editSnapshot(@PathVariable String id, Model model) {
        model.addAttribute("snapshotId", id);
        return "snapshot-edit";
    }
}
