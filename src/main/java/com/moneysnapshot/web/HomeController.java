package com.moneysnapshot.web;

import com.moneysnapshot.dashboard.SnapshotPanelResponse;
import com.moneysnapshot.dashboard.SnapshotPanelService;
import com.moneysnapshot.shared.i18n.MessageBundleService;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HomeController {

    private static final Locale DEFAULT_LOCALE = Locale.forLanguageTag("pl");
    private static final List<Locale> SUPPORTED_LOCALES = List.of(DEFAULT_LOCALE, Locale.ENGLISH);

    private final MessageBundleService messageBundleService;
    private final SnapshotPanelService snapshotPanelService;

    public HomeController(MessageBundleService messageBundleService, SnapshotPanelService snapshotPanelService) {
        this.messageBundleService = messageBundleService;
        this.snapshotPanelService = snapshotPanelService;
    }

    @GetMapping("/home/messages")
    public Map<String, String> homeMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.homePageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/login/messages")
    public Map<String, String> loginMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.loginPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/home/snapshot-panel")
    public SnapshotPanelResponse snapshotPanel() {
        return snapshotPanelService.getPanel();
    }

    @GetMapping("/banks/messages")
    public Map<String, String> bankMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.bankPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/accounts/messages")
    public Map<String, String> accountMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.accountPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/banks-accounts/messages")
    public Map<String, String> banksAndAccountsMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.banksAndAccountsPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/snapshots/messages")
    public Map<String, String> snapshotMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.snapshotPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/reports/messages")
    public Map<String, String> reportMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.reportPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/users/messages")
    public Map<String, String> userMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.userPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/profile/messages")
    public Map<String, String> profileMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.profilePageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/settings/messages")
    public Map<String, String> settingsMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.settingsPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/savings-planning/messages")
    public Map<String, String> savingsPlanningMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.savingsPlanningPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/savings-planning-settings/messages")
    public Map<String, String> savingsPlanningSettingsMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.savingsPlanningSettingsPageMessages(resolveLocale(lang, acceptLanguage));
    }

    @GetMapping("/savings-planning-generator/messages")
    public Map<String, String> savingsPlanningGeneratorMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.savingsPlanningGeneratorPageMessages(resolveLocale(lang, acceptLanguage));
    }

    private Locale resolveLocale(String lang, String acceptLanguage) {
        Locale requestedLocale = Locale.forLanguageTag(lang == null ? "" : lang);
        if (!requestedLocale.getLanguage().isBlank()) {
            return requestedLocale;
        }

        if (acceptLanguage == null || acceptLanguage.isBlank()) {
            return DEFAULT_LOCALE;
        }

        try {
            Locale matchedLocale = Locale.lookup(Locale.LanguageRange.parse(acceptLanguage), SUPPORTED_LOCALES);
            return matchedLocale == null ? DEFAULT_LOCALE : matchedLocale;
        } catch (IllegalArgumentException exception) {
            return DEFAULT_LOCALE;
        }
    }
}
