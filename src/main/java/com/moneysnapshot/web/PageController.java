package com.moneysnapshot.web;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class PageController {

    @GetMapping("/")
    public String home() {
        return "index";
    }

    @GetMapping("/login")
    public String login() {
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

    @GetMapping("/reports.html")
    public String reports() {
        return "reports";
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
