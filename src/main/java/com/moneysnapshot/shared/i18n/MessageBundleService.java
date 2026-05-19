package com.moneysnapshot.shared.i18n;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

@Service
public class MessageBundleService {

    private static final Set<String> COMMON_KEYS = Set.of(
            "app.name",
            "common.delete.cancel",
            "common.delete.confirm",
            "common.nav.accounts",
            "common.nav.banks",
            "common.nav.home",
            "common.nav.language",
            "common.nav.logout",
            "common.nav.profile",
            "common.nav.reports",
            "common.nav.settings",
            "common.nav.users"
    );

    private static final Set<String> HOME_PAGE_KEYS = Set.of(
            "home.hero.eyebrow",
            "home.hero.title",
            "home.hero.subtitle",
            "home.hero.primaryAction",
            "home.hero.snapshotsAction",
            "home.hero.accountsAction",
            "home.hero.secondaryAction",
            "home.summary.accounts",
            "home.summary.balance",
            "home.summary.change",
            "home.feature.snapshots.title",
            "home.feature.snapshots.description",
            "home.feature.accounts.title",
            "home.feature.accounts.description",
            "home.feature.banks.title",
            "home.feature.banks.description",
            "home.feature.reports.title",
            "home.feature.reports.description"
    );

    private static final Set<String> LOGIN_PAGE_KEYS = Set.of(
            "login.error",
            "login.form.email",
            "login.form.password",
            "login.form.submit",
            "login.heading.eyebrow",
            "login.heading.subtitle",
            "login.heading.title",
            "login.logout"
    );

    private static final Set<String> BANK_PAGE_KEYS = Set.of(
            "banks.actions.delete",
            "banks.actions.refresh",
            "banks.delete.cancel",
            "banks.delete.confirm",
            "banks.delete.message",
            "banks.delete.success",
            "banks.delete.title",
            "banks.empty",
            "banks.error.create",
            "banks.error.delete",
            "banks.error.duplicate",
            "banks.error.inUse",
            "banks.error.load",
            "banks.error.notFound",
            "banks.form.add",
            "banks.form.name",
            "banks.form.requiredName",
            "banks.form.success",
            "banks.form.title",
            "banks.heading.eyebrow",
            "banks.heading.subtitle",
            "banks.heading.title",
            "banks.loading",
            "banks.table.actions",
            "banks.table.createdAt",
            "banks.table.name",
            "banks.table.normalizedName",
            "banks.table.title",
            "banks.table.updatedAt"
    );

    private static final Set<String> ACCOUNT_PAGE_KEYS = Set.of(
            "accounts.actions.add",
            "accounts.actions.delete",
            "accounts.actions.edit",
            "accounts.actions.refresh",
            "accounts.accountType.BANK_ACCOUNT",
            "accounts.accountType.CASH",
            "accounts.accountType.INVESTMENT",
            "accounts.accountType.SAVINGS",
            "accounts.empty",
            "accounts.delete.message",
            "accounts.delete.success",
            "accounts.delete.title",
            "accounts.error.create",
            "accounts.error.delete",
            "accounts.error.duplicate",
            "accounts.error.inUse",
            "accounts.error.load",
            "accounts.error.loadAccount",
            "accounts.error.loadBanks",
            "accounts.error.notFound",
            "accounts.error.update",
            "accounts.form.accountType",
            "accounts.form.bank",
            "accounts.form.bankPlaceholder",
            "accounts.form.cancel",
            "accounts.form.currency",
            "accounts.form.description",
            "accounts.form.edit.eyebrow",
            "accounts.form.edit.subtitle",
            "accounts.form.edit.title",
            "accounts.form.eyebrow",
            "accounts.form.name",
            "accounts.form.required",
            "accounts.form.status",
            "accounts.form.subtitle",
            "accounts.form.submit",
            "accounts.form.success",
            "accounts.form.title",
            "accounts.form.update",
            "accounts.heading.eyebrow",
            "accounts.heading.subtitle",
            "accounts.heading.title",
            "accounts.loading",
            "accounts.status.ACTIVE",
            "accounts.status.CLOSED",
            "accounts.status.SUSPENDED",
            "accounts.table.accountType",
            "accounts.table.actions",
            "accounts.table.bank",
            "accounts.table.createdAt",
            "accounts.table.currency",
            "accounts.table.name",
            "accounts.table.status",
            "accounts.table.title",
            "accounts.table.updatedAt"
    );

    private static final Set<String> SNAPSHOT_PAGE_KEYS = Set.of(
            "snapshots.error.accountNotFound",
            "snapshots.error.create",
            "snapshots.error.delete",
            "snapshots.error.duplicate",
            "snapshots.error.load",
            "snapshots.error.loadAccounts",
            "snapshots.error.loadSnapshot",
            "snapshots.error.notFound",
            "snapshots.error.update",
            "snapshots.actions.add",
            "snapshots.actions.addBulk",
            "snapshots.actions.delete",
            "snapshots.actions.edit",
            "snapshots.actions.refresh",
            "snapshots.delete.message",
            "snapshots.delete.success",
            "snapshots.delete.title",
            "snapshots.empty",
            "snapshots.form.account",
            "snapshots.form.accountPlaceholder",
            "snapshots.form.balance",
            "snapshots.form.cancel",
            "snapshots.form.date",
            "snapshots.form.edit.eyebrow",
            "snapshots.form.edit.subtitle",
            "snapshots.form.edit.title",
            "snapshots.form.eyebrow",
            "snapshots.form.note",
            "snapshots.form.lastSnapshot",
            "snapshots.form.noLastSnapshot",
            "snapshots.form.rememberAccount",
            "snapshots.form.required",
            "snapshots.form.submit",
            "snapshots.form.subtitle",
            "snapshots.form.success",
            "snapshots.form.title",
            "snapshots.form.update",
            "snapshots.filter.account",
            "snapshots.filter.allAccounts",
            "snapshots.heading.eyebrow",
            "snapshots.heading.subtitle",
            "snapshots.heading.title",
            "snapshots.loading",
            "snapshots.pagination.info",
            "snapshots.pagination.next",
            "snapshots.pagination.previous",
            "snapshots.pagination.size",
            "snapshots.table.account",
            "snapshots.table.actions",
            "snapshots.table.balance",
            "snapshots.table.createdAt",
            "snapshots.table.date",
            "snapshots.table.note",
            "snapshots.table.title",
            "snapshots.bulk.commonNote",
            "snapshots.bulk.empty",
            "snapshots.bulk.eyebrow",
            "snapshots.bulk.noLastBalance",
            "snapshots.bulk.requiredBalance",
            "snapshots.bulk.requiredDate",
            "snapshots.bulk.submit",
            "snapshots.bulk.subtitle",
            "snapshots.bulk.success",
            "snapshots.bulk.table.title",
            "snapshots.bulk.title",
            "snapshots.bulk.validationError"
    );

    private static final Set<String> REPORT_PAGE_KEYS = Set.of(
            "reports.actions.refresh",
            "reports.chart.empty",
            "reports.controls.from",
            "reports.controls.period",
            "reports.controls.scope",
            "reports.controls.to",
            "reports.empty",
            "reports.error.customRange",
            "reports.error.load",
            "reports.heading.eyebrow",
            "reports.heading.subtitle",
            "reports.heading.title",
            "reports.loading",
            "reports.period.1m",
            "reports.period.3m",
            "reports.period.1y",
            "reports.period.2y",
            "reports.period.custom",
            "reports.scope.accounts",
            "reports.scope.banks",
            "reports.scope.total",
            "reports.table.change",
            "reports.table.currency",
            "reports.table.end",
            "reports.table.name",
            "reports.table.percent",
            "reports.table.start",
            "reports.table.title",
            "reports.total.name"
    );

    private static final Set<String> USER_PAGE_KEYS = Set.of(
            "users.actions.add",
            "users.actions.delete",
            "users.actions.edit",
            "users.actions.refresh",
            "users.delete.message",
            "users.delete.success",
            "users.delete.title",
            "users.empty",
            "users.error.create",
            "users.error.delete",
            "users.error.deleteSelf",
            "users.error.duplicate",
            "users.error.invalid",
            "users.error.load",
            "users.error.loadRoles",
            "users.error.notFound",
            "users.error.update",
            "users.form.cancel",
            "users.form.description",
            "users.form.editTitle",
            "users.form.email",
            "users.form.firstName",
            "users.form.lastName",
            "users.form.password",
            "users.form.required",
            "users.form.requiredPassword",
            "users.form.role",
            "users.form.status",
            "users.form.submit",
            "users.form.success",
            "users.form.title",
            "users.form.update",
            "users.heading.eyebrow",
            "users.heading.subtitle",
            "users.heading.title",
            "users.loading",
            "users.status.ACTIVE",
            "users.status.SUSPENDED",
            "users.table.actions",
            "users.table.email",
            "users.table.name",
            "users.table.role",
            "users.table.status",
            "users.table.title",
            "users.table.updatedAt"
    );

    private static final Set<String> PROFILE_PAGE_KEYS = Set.of(
            "profile.error.load",
            "profile.error.update",
            "profile.form.description",
            "profile.form.email",
            "profile.form.firstName",
            "profile.form.lastName",
            "profile.form.password",
            "profile.form.required",
            "profile.form.submit",
            "profile.form.success",
            "profile.heading.eyebrow",
            "profile.heading.subtitle",
            "profile.heading.title"
    );

    private static final Set<String> SETTINGS_PAGE_KEYS = Set.of(
            "settings.error.load",
            "settings.error.update",
            "settings.form.dateTimeFormat",
            "settings.form.defaultCurrency",
            "settings.form.moneyFormat",
            "settings.form.required",
            "settings.form.submit",
            "settings.form.success",
            "settings.heading.eyebrow",
            "settings.heading.subtitle",
            "settings.heading.title"
    );

    private final MessageSource messageSource;

    public MessageBundleService(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    public Map<String, String> homePageMessages(Locale locale) {
        return messages(HOME_PAGE_KEYS, locale);
    }

    public Map<String, String> loginPageMessages(Locale locale) {
        return messages(LOGIN_PAGE_KEYS, locale);
    }

    public Map<String, String> bankPageMessages(Locale locale) {
        return messages(BANK_PAGE_KEYS, locale);
    }

    public Map<String, String> accountPageMessages(Locale locale) {
        return messages(ACCOUNT_PAGE_KEYS, locale);
    }

    public Map<String, String> snapshotPageMessages(Locale locale) {
        return messages(SNAPSHOT_PAGE_KEYS, locale);
    }

    public Map<String, String> reportPageMessages(Locale locale) {
        return messages(REPORT_PAGE_KEYS, locale);
    }

    public Map<String, String> userPageMessages(Locale locale) {
        return messages(USER_PAGE_KEYS, locale);
    }

    public Map<String, String> profilePageMessages(Locale locale) {
        return messages(PROFILE_PAGE_KEYS, locale);
    }

    public Map<String, String> settingsPageMessages(Locale locale) {
        return messages(SETTINGS_PAGE_KEYS, locale);
    }

    private Map<String, String> messages(Set<String> keys, Locale locale) {
        return java.util.stream.Stream.concat(COMMON_KEYS.stream(), keys.stream())
                .sorted()
                .collect(java.util.stream.Collectors.toMap(
                        key -> key,
                        key -> messageSource.getMessage(key, null, locale),
                        (left, right) -> left,
                        java.util.LinkedHashMap::new
                ));
    }
}
