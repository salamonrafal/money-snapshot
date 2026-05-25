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
            "common.nav.banksAccounts",
            "common.nav.banks",
            "common.nav.home",
            "common.nav.language",
            "common.nav.menu.close",
            "common.nav.menu.open",
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
            "home.hero.banksAccountsAction",
            "home.summary.accounts",
            "home.summary.balance",
            "home.summary.change",
            "home.feature.snapshots.title",
            "home.feature.snapshots.description",
            "home.feature.banksAccounts.title",
            "home.feature.banksAccounts.description",
            "home.feature.reports.title",
            "home.feature.reports.description",
            "home.feature.savingsPlanning.title",
            "home.feature.savingsPlanning.description",
            "home.feature.savingsPlanning.action",
            "snapshots.actions.addBulk"
    );

    private static final Set<String> SAVINGS_PLANNING_PAGE_KEYS = Set.of(
            "savingsPlanning.heading.eyebrow",
            "savingsPlanning.heading.title",
            "savingsPlanning.heading.subtitle",
            "savingsPlanning.actions.generate",
            "savingsPlanning.actions.settings",
            "savingsPlanning.actions.clear",
            "savingsPlanning.actions.refresh",
            "savingsPlanning.delete.title",
            "savingsPlanning.delete.message",
            "savingsPlanning.delete.subject",
            "savingsPlanning.delete.success",
            "savingsPlanning.empty.title",
            "savingsPlanning.empty.description",
            "savingsPlanning.summary.generatedAt",
            "savingsPlanning.summary.period",
            "savingsPlanning.summary.accounts",
            "savingsPlanning.summary.duration",
            "savingsPlanning.table.title",
            "savingsPlanning.table.date",
            "savingsPlanning.table.summary",
            "savingsPlanning.table.account",
            "savingsPlanning.table.bank",
            "savingsPlanning.table.type",
            "savingsPlanning.table.currency",
            "savingsPlanning.table.snapshotDate",
            "savingsPlanning.table.startBalance",
            "savingsPlanning.table.monthlyContribution",
            "savingsPlanning.table.projectedBalance",
            "savingsPlanning.loading",
            "savingsPlanning.error.load",
            "savingsPlanning.error.delete",
            "accounts.accountType.BANK_ACCOUNT",
            "accounts.accountType.CASH",
            "accounts.accountType.INVESTMENT",
            "accounts.accountType.SAVINGS"
    );

    private static final Set<String> SAVINGS_PLANNING_SETTINGS_PAGE_KEYS = Set.of(
            "savingsPlanning.heading.title",
            "savingsPlanningSettings.heading.eyebrow",
            "savingsPlanningSettings.heading.title",
            "savingsPlanningSettings.heading.subtitle",
            "savingsPlanningSettings.table.title",
            "savingsPlanningSettings.table.account",
            "savingsPlanningSettings.table.bank",
            "savingsPlanningSettings.table.currency",
            "savingsPlanningSettings.table.forecast",
            "savingsPlanningSettings.empty",
            "savingsPlanningSettings.loading",
            "savingsPlanningSettings.actions.back",
            "savingsPlanningSettings.actions.refresh",
            "savingsPlanningSettings.form.submit",
            "savingsPlanningSettings.form.success",
            "savingsPlanningSettings.form.required",
            "savingsPlanningSettings.form.hint",
            "savingsPlanningSettings.error.load",
            "savingsPlanningSettings.error.update"
    );

    private static final Set<String> SAVINGS_PLANNING_GENERATOR_PAGE_KEYS = Set.of(
            "savingsPlanningGenerator.heading.eyebrow",
            "savingsPlanningGenerator.heading.title",
            "savingsPlanningGenerator.heading.subtitle",
            "savingsPlanningGenerator.form.title",
            "savingsPlanningGenerator.form.startDate",
            "savingsPlanningGenerator.form.duration",
            "savingsPlanningGenerator.form.duration.6m",
            "savingsPlanningGenerator.form.duration.1y",
            "savingsPlanningGenerator.form.duration.2y",
            "savingsPlanningGenerator.form.duration.5y",
            "savingsPlanningGenerator.form.duration.10y",
            "savingsPlanningGenerator.form.hint",
            "savingsPlanningGenerator.form.submit",
            "savingsPlanningGenerator.form.required",
            "savingsPlanningGenerator.form.success",
            "savingsPlanningGenerator.warning.title",
            "savingsPlanningGenerator.warning.description",
            "savingsPlanningGenerator.actions.back",
            "savingsPlanningGenerator.error.generate",
            "savingsPlanningGenerator.error.loadPlan"
    );

    private static final Set<String> LOGIN_PAGE_KEYS = Set.of(
            "login.error",
            "login.form.email",
            "login.form.password",
            "login.form.rememberMe",
            "login.form.rememberMeUnavailable",
            "login.form.submit",
            "login.heading.eyebrow",
            "login.heading.subtitle",
            "login.heading.title",
            "login.logout"
    );

    private static final Set<String> BANK_PAGE_KEYS = Set.of(
            "banks.actions.add",
            "banks.actions.delete",
            "banks.actions.edit",
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
            "banks.error.loadBank",
            "banks.error.load",
            "banks.error.notFound",
            "banks.error.update",
            "banks.form.add",
            "banks.form.cancel",
            "banks.form.edit.eyebrow",
            "banks.form.edit.subtitle",
            "banks.form.edit.title",
            "banks.form.eyebrow",
            "banks.form.name",
            "banks.form.requiredName",
            "banks.form.subtitle",
            "banks.form.success",
            "banks.form.title",
            "banks.form.update",
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

    private static final Set<String> BANKS_AND_ACCOUNTS_PAGE_KEYS =
            java.util.stream.Stream.concat(BANK_PAGE_KEYS.stream(), ACCOUNT_PAGE_KEYS.stream())
                    .collect(java.util.stream.Collectors.collectingAndThen(
                            java.util.stream.Collectors.toSet(),
                            keys -> {
                                keys.add("banksAccounts.heading.eyebrow");
                                keys.add("banksAccounts.heading.subtitle");
                                keys.add("banksAccounts.heading.title");
                                keys.add("banksAccounts.aria.management");
                                keys.add("banksAccounts.actions.info");
                                keys.add("banksAccounts.info.accountTitle");
                                keys.add("banksAccounts.info.bankTitle");
                                keys.add("banksAccounts.info.close");
                                keys.add("banksAccounts.info.title");
                                keys.add("banksAccounts.info.createdAt");
                                keys.add("banksAccounts.info.notAvailable");
                                keys.add("banksAccounts.info.owner");
                                keys.add("banksAccounts.info.updatedAt");
                                keys.add("banksAccounts.table.accounts");
                                keys.add("banksAccounts.table.collapse");
                                keys.add("banksAccounts.table.expand");
                                return Set.copyOf(keys);
                            }
                    ));

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
            "snapshots.update.success",
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
            "snapshots.form.type",
            "snapshots.form.typePlaceholder",
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
            "snapshots.filter.clear",
            "snapshots.filter.date",
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
            "snapshots.table.type",
            "snapshots.table.title",
            "snapshots.type.FINAL",
            "snapshots.type.PARTIAL",
            "snapshots.bulk.commonNote",
            "snapshots.bulk.empty",
            "snapshots.bulk.eyebrow",
            "snapshots.bulk.noLastBalance",
            "snapshots.bulk.requiredBalance",
            "snapshots.bulk.requiredDate",
            "snapshots.bulk.requiredType",
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
            "reports.chart.aria.changes",
            "reports.chart.aria.overview",
            "reports.controls.from",
            "reports.controls.period",
            "reports.controls.scope",
            "reports.controls.scope.report",
            "reports.controls.scope.overview",
            "reports.controls.to",
            "reports.empty",
            "reports.error.customRange",
            "reports.error.historyRangeTooLarge",
            "reports.error.load",
            "reports.heading.eyebrow",
            "reports.heading.subtitle",
            "reports.heading.title",
            "reports.history.pagination.aria",
            "reports.loading",
            "reports.nav.aria",
            "reports.nav.title",
            "reports.period.1m",
            "reports.period.2m",
            "reports.period.3m",
            "reports.period.6m",
            "reports.period.1y",
            "reports.period.2y",
            "reports.period.billing",
            "reports.period.custom",
            "reports.scope.accounts",
            "reports.scope.banks",
            "reports.scope.total",
            "reports.history.account",
            "reports.history.balance",
            "reports.history.bank",
            "reports.history.date",
            "reports.history.diff",
            "reports.history.empty",
            "reports.history.pagination.info",
            "reports.history.pagination.next",
            "reports.history.pagination.previous",
            "reports.history.pagination.size",
            "reports.history.title",
            "reports.overview.balance",
            "reports.overview.empty",
            "reports.overview.share",
            "reports.overview.title",
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
            "settings.form.billingMonthStartDay",
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

    public Map<String, String> banksAndAccountsPageMessages(Locale locale) {
        return messages(BANKS_AND_ACCOUNTS_PAGE_KEYS, locale);
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

    public Map<String, String> savingsPlanningPageMessages(Locale locale) {
        return messages(SAVINGS_PLANNING_PAGE_KEYS, locale);
    }

    public Map<String, String> savingsPlanningSettingsPageMessages(Locale locale) {
        return messages(SAVINGS_PLANNING_SETTINGS_PAGE_KEYS, locale);
    }

    public Map<String, String> savingsPlanningGeneratorPageMessages(Locale locale) {
        return messages(SAVINGS_PLANNING_GENERATOR_PAGE_KEYS, locale);
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
