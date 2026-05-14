package com.moneysnapshot.web;

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

    public HomeController(MessageBundleService messageBundleService) {
        this.messageBundleService = messageBundleService;
    }

    @GetMapping("/home/messages")
    public Map<String, String> homeMessages(
            @RequestParam(required = false) String lang,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return messageBundleService.homePageMessages(resolveLocale(lang, acceptLanguage));
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
