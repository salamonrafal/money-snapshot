package com.moneysnapshot.shared.i18n;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

@Service
public class MessageBundleService {

    private static final Set<String> HOME_PAGE_KEYS = Set.of(
            "app.name",
            "home.hero.eyebrow",
            "home.hero.title",
            "home.hero.subtitle",
            "home.hero.primaryAction",
            "home.hero.secondaryAction",
            "home.nav.language",
            "home.summary.accounts",
            "home.summary.balance",
            "home.summary.change",
            "home.feature.snapshots.title",
            "home.feature.snapshots.description",
            "home.feature.accounts.title",
            "home.feature.accounts.description",
            "home.feature.reports.title",
            "home.feature.reports.description"
    );

    private final MessageSource messageSource;

    public MessageBundleService(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    public Map<String, String> homePageMessages(Locale locale) {
        return HOME_PAGE_KEYS.stream()
                .sorted()
                .collect(java.util.stream.Collectors.toMap(
                        key -> key,
                        key -> messageSource.getMessage(key, null, locale),
                        (left, right) -> left,
                        java.util.LinkedHashMap::new
                ));
    }
}
