package com.moneysnapshot.snapshot;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.snapshot.web.SnapshotFinalWarningsResponse;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class SnapshotFinalWarningQueryService {

    private final AccountSnapshotRepository snapshotRepository;
    private final AccountRepository accountRepository;
    private final CurrentUserService currentUserService;
    private final UserSettingsService userSettingsService;
    private final Clock clock;

    @Autowired
    public SnapshotFinalWarningQueryService(
            AccountSnapshotRepository snapshotRepository,
            AccountRepository accountRepository,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService
    ) {
        this(snapshotRepository, accountRepository, currentUserService, userSettingsService, Clock.systemUTC());
    }

    SnapshotFinalWarningQueryService(
            AccountSnapshotRepository snapshotRepository,
            AccountRepository accountRepository,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService,
            Clock clock
    ) {
        this.snapshotRepository = snapshotRepository;
        this.accountRepository = accountRepository;
        this.currentUserService = currentUserService;
        this.userSettingsService = userSettingsService;
        this.clock = clock;
    }

    public SnapshotFinalWarningsResponse warnings() {
        UUID ownerId = currentUserService.currentUserId();
        int billingMonthEndDay = userSettingsService.currentUserSettings().billingMonthStartDay();
        LocalDate currentPeriodStart = resolvePeriodStart(LocalDate.now(clock), billingMonthEndDay);
        List<AccountSnapshot> snapshots = snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId);
        Map<UUID, LocalDate> firstSnapshotDateByAccount = snapshots.stream()
                .collect(java.util.stream.Collectors.toMap(
                        snapshot -> snapshot.getAccount().getId(),
                        AccountSnapshot::getSnapshotDate,
                        (left, right) -> left.isBefore(right) ? left : right,
                        LinkedHashMap::new
                ));
        Map<UUID, AccountInfo> trackedAccounts = accountRepository.findTrackedAccountsVisibleInSnapshotsByOwnerId(ownerId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        Account::getId,
                        account -> new AccountInfo(account.getName(), trackingStartedAt(account, firstSnapshotDateByAccount)),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));
        Map<PeriodKey, Map<UUID, PeriodStats>> statsByPeriod = new LinkedHashMap<>();

        snapshots.stream()
                .filter(snapshot -> trackedAccounts.containsKey(snapshot.getAccount().getId()))
                .forEach(snapshot -> {
                    LocalDate periodStart = resolvePeriodStart(snapshot.getSnapshotDate(), billingMonthEndDay);
                    LocalDate periodEnd = resolvePeriodEnd(periodStart, billingMonthEndDay);
                    PeriodKey periodKey = new PeriodKey(periodStart, periodEnd);
                    PeriodStats stats = statsByPeriod
                            .computeIfAbsent(periodKey, ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(snapshot.getAccount().getId(), ignored -> new PeriodStats());
                    stats.totalSnapshots += 1;
                    if (snapshot.getSnapshotType() == SnapshotType.FINAL) {
                        stats.finalSnapshots += 1;
                    }
                });
        includeCompletedPeriods(statsByPeriod, trackedAccounts, currentPeriodStart, billingMonthEndDay);

        List<SnapshotFinalWarningsResponse.PeriodWarning> missingFinalPeriods = statsByPeriod.entrySet().stream()
                .map(entry -> new SnapshotFinalWarningsResponse.PeriodWarning(
                        entry.getKey().periodStart(),
                        entry.getKey().periodEnd(),
                        trackedAccounts.entrySet().stream()
                                .filter(accountEntry -> isAccountApplicableToPeriod(accountEntry.getValue(), entry.getKey()))
                                .filter(accountEntry -> entry.getValue()
                                        .getOrDefault(accountEntry.getKey(), PeriodStats.empty())
                                        .finalSnapshots == 0)
                                .map(accountEntry -> new SnapshotFinalWarningsResponse.AccountWarning(
                                        accountEntry.getValue().name(),
                                        0
                                ))
                                .sorted(Comparator.comparing(SnapshotFinalWarningsResponse.AccountWarning::accountName, String.CASE_INSENSITIVE_ORDER))
                                .toList()
                ))
                .filter(periodWarning -> !periodWarning.accounts().isEmpty())
                .filter(periodWarning -> periodWarning.periodEndDate().isBefore(currentPeriodStart))
                .sorted(Comparator.comparing(SnapshotFinalWarningsResponse.PeriodWarning::periodStartDate).reversed())
                .toList();

        List<SnapshotFinalWarningsResponse.PeriodWarning> multipleFinalPeriods = statsByPeriod.entrySet().stream()
                .map(entry -> new SnapshotFinalWarningsResponse.PeriodWarning(
                        entry.getKey().periodStart(),
                        entry.getKey().periodEnd(),
                        entry.getValue().entrySet().stream()
                                .filter(accountEntry -> accountEntry.getValue().finalSnapshots > 1)
                                .map(accountEntry -> new SnapshotFinalWarningsResponse.AccountWarning(
                                        trackedAccounts.getOrDefault(accountEntry.getKey(), AccountInfo.missing(accountEntry.getKey())).name(),
                                        accountEntry.getValue().finalSnapshots
                                ))
                                .sorted(Comparator.comparing(SnapshotFinalWarningsResponse.AccountWarning::accountName, String.CASE_INSENSITIVE_ORDER))
                                .toList()
                ))
                .filter(entry -> !entry.accounts().isEmpty())
                .sorted(Comparator.comparing(SnapshotFinalWarningsResponse.PeriodWarning::periodStartDate).reversed())
                .toList();

        return new SnapshotFinalWarningsResponse(missingFinalPeriods, multipleFinalPeriods);
    }

    private void includeCompletedPeriods(
            Map<PeriodKey, Map<UUID, PeriodStats>> statsByPeriod,
            Map<UUID, AccountInfo> trackedAccounts,
            LocalDate currentPeriodStart,
            int billingMonthEndDay
    ) {
        firstTrackedAccountPeriodStart(trackedAccounts, statsByPeriod, billingMonthEndDay)
                .ifPresent(firstPeriodStart -> {
                    LocalDate periodStart = firstPeriodStart;
                    LocalDate periodEnd = resolvePeriodEnd(periodStart, billingMonthEndDay);
                    while (periodEnd.isBefore(currentPeriodStart)) {
                        statsByPeriod.computeIfAbsent(new PeriodKey(periodStart, periodEnd), ignored -> new LinkedHashMap<>());
                        periodStart = periodEnd.plusDays(1);
                        periodEnd = resolvePeriodEnd(periodStart, billingMonthEndDay);
                    }
                });
    }

    private Optional<LocalDate> firstTrackedAccountPeriodStart(
            Map<UUID, AccountInfo> trackedAccounts,
            Map<PeriodKey, Map<UUID, PeriodStats>> statsByPeriod,
            int billingMonthEndDay
    ) {
        Optional<LocalDate> firstAccountPeriodStart = trackedAccounts.values().stream()
                .map(AccountInfo::trackingStartedAt)
                .filter(java.util.Objects::nonNull)
                .map(trackingStartedAt -> resolvePeriodStart(trackingStartedAt, billingMonthEndDay))
                .min(LocalDate::compareTo);
        if (firstAccountPeriodStart.isPresent()) {
            return firstAccountPeriodStart;
        }

        return statsByPeriod.keySet().stream()
                .map(PeriodKey::periodStart)
                .min(LocalDate::compareTo);
    }

    private boolean isAccountApplicableToPeriod(AccountInfo account, PeriodKey period) {
        if (account.trackingStartedAt() == null) {
            return true;
        }

        return !account.trackingStartedAt().isAfter(period.periodEnd());
    }

    private LocalDate trackingStartedAt(Account account, Map<UUID, LocalDate> firstSnapshotDateByAccount) {
        if (account.getOwner() == null) {
            return firstSnapshotDateByAccount.get(account.getId());
        }

        return Optional.ofNullable(account.getCreatedAt())
                .map(createdAt -> createdAt.toLocalDate())
                .orElse(null);
    }

    private LocalDate resolvePeriodStart(LocalDate date, int billingMonthEndDay) {
        int normalizedEndDay = Math.max(1, Math.min(31, billingMonthEndDay));
        LocalDate currentMonthEnd = date.withDayOfMonth(Math.min(normalizedEndDay, date.lengthOfMonth()));
        if (date.isAfter(currentMonthEnd)) {
            return currentMonthEnd.plusDays(1);
        }

        LocalDate previousMonth = date.minusMonths(1);
        LocalDate previousMonthEnd = previousMonth.withDayOfMonth(Math.min(normalizedEndDay, previousMonth.lengthOfMonth()));
        return previousMonthEnd.plusDays(1);
    }

    private LocalDate resolvePeriodEnd(LocalDate periodStart, int billingMonthEndDay) {
        int normalizedEndDay = Math.max(1, Math.min(31, billingMonthEndDay));
        LocalDate currentMonthEnd = periodStart.withDayOfMonth(Math.min(normalizedEndDay, periodStart.lengthOfMonth()));
        if (!currentMonthEnd.isBefore(periodStart)) {
            return currentMonthEnd;
        }

        LocalDate nextMonth = periodStart.plusMonths(1);
        return nextMonth.withDayOfMonth(Math.min(normalizedEndDay, nextMonth.lengthOfMonth()));
    }

    private record PeriodKey(LocalDate periodStart, LocalDate periodEnd) {
    }

    private record AccountInfo(String name, LocalDate trackingStartedAt) {

        private static AccountInfo missing(UUID accountId) {
            return new AccountInfo(accountId.toString(), null);
        }
    }

    private static final class PeriodStats {
        private static final PeriodStats EMPTY = new PeriodStats();

        private long totalSnapshots;
        private long finalSnapshots;

        private static PeriodStats empty() {
            return EMPTY;
        }
    }
}
