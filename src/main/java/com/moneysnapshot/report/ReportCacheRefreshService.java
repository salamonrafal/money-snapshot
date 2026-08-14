package com.moneysnapshot.report;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.AppUserRepository;
import com.moneysnapshot.security.UserSettingRepository;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.snapshot.AccountSnapshot;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.snapshot.SnapshotType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Set;
import java.util.TreeSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;

@Service
public class ReportCacheRefreshService {

    private static final Logger log = LoggerFactory.getLogger(ReportCacheRefreshService.class);
    private static final int MAX_DIRTY_OWNER_BATCH = 20;
    private static final int MAX_BILLING_COMPARISON_PERIODS = 6;

    private final ReportCacheRefreshStateRepository refreshStateRepository;
    private final ReportDailyBalanceCacheRepository dailyBalanceCacheRepository;
    private final ReportAverageContributionCacheRepository averageContributionCacheRepository;
    private final ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository;
    private final ReportBillingPeriodComparisonCacheRepository billingPeriodComparisonCacheRepository;
    private final AppUserRepository appUserRepository;
    private final UserSettingRepository userSettingRepository;
    private final AccountSnapshotRepository snapshotRepository;
    private final TransactionOperations failureStateTransaction;
    private final Clock clock;
    private final ConcurrentMap<UUID, ReentrantLock> ownerLocks = new ConcurrentHashMap<>();

    @Autowired
    public ReportCacheRefreshService(
            ReportCacheRefreshStateRepository refreshStateRepository,
            ReportDailyBalanceCacheRepository dailyBalanceCacheRepository,
            ReportAverageContributionCacheRepository averageContributionCacheRepository,
            ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository,
            ReportBillingPeriodComparisonCacheRepository billingPeriodComparisonCacheRepository,
            AppUserRepository appUserRepository,
            UserSettingRepository userSettingRepository,
            AccountSnapshotRepository snapshotRepository,
            PlatformTransactionManager transactionManager
    ) {
        this(
                refreshStateRepository,
                dailyBalanceCacheRepository,
                averageContributionCacheRepository,
                finalSnapshotCacheRepository,
                billingPeriodComparisonCacheRepository,
                appUserRepository,
                userSettingRepository,
                snapshotRepository,
                newRequiresNewTransaction(transactionManager),
                Clock.systemUTC()
        );
    }

    ReportCacheRefreshService(
            ReportCacheRefreshStateRepository refreshStateRepository,
            ReportDailyBalanceCacheRepository dailyBalanceCacheRepository,
            ReportAverageContributionCacheRepository averageContributionCacheRepository,
            ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository,
            ReportBillingPeriodComparisonCacheRepository billingPeriodComparisonCacheRepository,
            AppUserRepository appUserRepository,
            UserSettingRepository userSettingRepository,
            AccountSnapshotRepository snapshotRepository,
            TransactionOperations failureStateTransaction,
            Clock clock
    ) {
        this.refreshStateRepository = refreshStateRepository;
        this.dailyBalanceCacheRepository = dailyBalanceCacheRepository;
        this.averageContributionCacheRepository = averageContributionCacheRepository;
        this.finalSnapshotCacheRepository = finalSnapshotCacheRepository;
        this.billingPeriodComparisonCacheRepository = billingPeriodComparisonCacheRepository;
        this.appUserRepository = appUserRepository;
        this.userSettingRepository = userSettingRepository;
        this.snapshotRepository = snapshotRepository;
        this.failureStateTransaction = failureStateTransaction;
        this.clock = clock;
    }

    @Transactional
    public void ensureRefreshStatesExist() {
        List<AppUser> users = appUserRepository.findAllByOrderByEmail();
        users.forEach(user -> refreshStateRepository.findByOwnerId(user.getId())
                .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(user.getId()))));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDirty(UUID ownerId) {
        withOwnerLock(ownerId, () -> {
            AppUser owner = lockOwner(ownerId);
            if (owner == null) {
                return;
            }

            ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId)
                    .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(ownerId)));
            state.markDirty();
            refreshStateRepository.save(state);
        });
    }

    public List<UUID> findDirtyOwners(int limit) {
        if (limit <= 0) {
            return List.of();
        }

        return refreshStateRepository.findTop20ByDirtyTrueOrderByRefreshRequestedAtAsc().stream()
                .limit(Math.min(limit, MAX_DIRTY_OWNER_BATCH))
                .map(ReportCacheRefreshState::getOwnerId)
                .toList();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clearOwner(UUID ownerId) {
        withOwnerLock(ownerId, () -> {
            AppUser owner = lockOwner(ownerId);
            if (owner == null) {
                return;
            }

            dailyBalanceCacheRepository.deleteByOwnerId(ownerId);
            averageContributionCacheRepository.deleteByOwnerId(ownerId);
            finalSnapshotCacheRepository.deleteByOwnerId(ownerId);
            billingPeriodComparisonCacheRepository.deleteByOwnerId(ownerId);

            ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId)
                    .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(ownerId)));
            state.markDirty();
            refreshStateRepository.save(state);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureOwnerCacheReady(UUID ownerId, LocalDate requiredDate) {
        withOwnerLock(ownerId, () -> {
            AppUser owner = lockOwner(ownerId);
            if (owner == null) {
                return;
            }

            ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId)
                    .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(ownerId)));
            boolean hasSnapshots = snapshotRepository.existsByOwnerId(ownerId);
            boolean cacheMissing = hasSnapshots && !dailyBalanceCacheRepository.existsByOwnerIdAndBalanceDate(ownerId, requiredDate);
            boolean hasFinalSnapshots = snapshotRepository.existsByOwnerIdAndSnapshotType(ownerId, SnapshotType.FINAL);
            boolean finalCacheMissing = hasFinalSnapshots && !finalSnapshotCacheRepository.existsByOwnerId(ownerId);
            boolean billingComparisonCacheMissing = hasSnapshots && !state.isBillingPeriodComparisonReady();
            if (state.isDirty() || cacheMissing || finalCacheMissing || billingComparisonCacheMissing) {
                refreshOwnerInternal(ownerId, state, owner);
            }
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void refreshOwner(UUID ownerId) {
        withOwnerLock(ownerId, () -> {
            ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId).orElse(null);
            AppUser owner = lockOwner(ownerId);
            if (state == null || owner == null) {
                return;
            }

            refreshOwnerInternal(ownerId, state, owner);
        });
    }

    private void refreshOwnerInternal(UUID ownerId, ReportCacheRefreshState state, AppUser owner) {
        try {
            List<AccountSnapshot> snapshots = snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId);
            rebuildDailyBalances(owner, snapshots);
            rebuildFinalSnapshots(owner, snapshots);
            rebuildBillingPeriodComparisons(owner, snapshots);
            rebuildAverageContributions(owner, snapshots);
            state.markRefreshed();
            refreshStateRepository.save(state);
        } catch (RuntimeException exception) {
            persistFailedState(ownerId, exception.getMessage());
            log.warn("Failed to refresh report cache for owner {}", ownerId, exception);
            throw exception;
        }
    }

    private void persistFailedState(UUID ownerId, String errorMessage) {
        failureStateTransaction.executeWithoutResult(status -> {
            ReportCacheRefreshState failureState = refreshStateRepository.findByOwnerId(ownerId)
                    .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(ownerId)));
            failureState.markFailed(errorMessage);
            refreshStateRepository.save(failureState);
        });
    }

    private void withOwnerLock(UUID ownerId, Runnable action) {
        ReentrantLock lock = ownerLocks.computeIfAbsent(ownerId, ignored -> new ReentrantLock());
        lock.lock();
        try {
            action.run();
        } finally {
            lock.unlock();
        }
    }

    private AppUser lockOwner(UUID ownerId) {
        return appUserRepository.findByIdForUpdate(ownerId).orElse(null);
    }

    private static TransactionOperations newRequiresNewTransaction(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template;
    }

    private void rebuildDailyBalances(AppUser owner, List<AccountSnapshot> snapshots) {
        dailyBalanceCacheRepository.deleteByOwnerId(owner.getId());
        dailyBalanceCacheRepository.flush();
        if (snapshots.isEmpty()) {
            return;
        }

        LocalDate today = LocalDate.now(clock);
        Map<UUID, List<AccountSnapshot>> snapshotsByAccountId = new HashMap<>();
        snapshots.forEach(snapshot -> snapshotsByAccountId
                .computeIfAbsent(snapshot.getAccount().getId(), ignored -> new ArrayList<>())
                .add(snapshot));

        List<ReportDailyBalanceCache> entries = new ArrayList<>();
        snapshotsByAccountId.values().forEach(accountSnapshots -> {
            accountSnapshots.sort(Comparator.comparing(AccountSnapshot::getSnapshotDate));
            AccountSnapshot firstSnapshot = accountSnapshots.get(0);
            int snapshotIndex = 0;
            AccountSnapshot currentSnapshot = firstSnapshot;

            for (LocalDate date = firstSnapshot.getSnapshotDate(); !date.isAfter(today); date = date.plusDays(1)) {
                while (snapshotIndex + 1 < accountSnapshots.size()
                        && !accountSnapshots.get(snapshotIndex + 1).getSnapshotDate().isAfter(date)) {
                    snapshotIndex += 1;
                    currentSnapshot = accountSnapshots.get(snapshotIndex);
                }

                entries.add(new ReportDailyBalanceCache(
                        owner,
                        currentSnapshot.getAccount(),
                        currentSnapshot.getAccount().getBank(),
                        date,
                        currentSnapshot.getSnapshotDate(),
                        currentSnapshot.getAccount().getName(),
                        currentSnapshot.getAccount().getBank().getName(),
                        currentSnapshot.getAccount().getCurrencyCode(),
                        currentSnapshot.getBalance()
                ));
            }
        });

        dailyBalanceCacheRepository.saveAll(entries);
        dailyBalanceCacheRepository.flush();
    }

    private void rebuildBillingPeriodComparisons(AppUser owner, List<AccountSnapshot> snapshots) {
        billingPeriodComparisonCacheRepository.deleteByOwnerId(owner.getId());
        billingPeriodComparisonCacheRepository.flush();

        int billingMonthEndDay = userSettingRepository
                .findByUserIdAndKey(owner.getId(), UserSettingsService.BILLING_MONTH_START_DAY)
                .map(setting -> parseBillingMonthEndDay(setting.getValue()))
                .orElse(1);
        List<CompletedBillingPeriod> completedPeriods = completedBillingPeriodsFromFinalSnapshots(snapshots, billingMonthEndDay);
        if (completedPeriods.size() < 2) {
            return;
        }

        CompletedBillingPeriod referencePeriod = completedPeriods.get(0);
        Map<String, BigDecimal> referenceChanges = referencePeriod.changes();

        List<ReportBillingPeriodComparisonCache> entries = new ArrayList<>();
        for (int completedIndex = 1; completedIndex < completedPeriods.size(); completedIndex += 1) {
            CompletedBillingPeriod period = completedPeriods.get(completedIndex);
            int periodIndex = completedIndex;
            Map<String, BigDecimal> changes = period.changes();
            Set<String> currencies = new TreeSet<>(period.currencies());
            currencies.addAll(referencePeriod.currencies());
            for (String currencyCode : currencies) {
                BigDecimal periodChange = changes.getOrDefault(currencyCode, BigDecimal.ZERO);
                BigDecimal referenceChange = referenceChanges.getOrDefault(currencyCode, BigDecimal.ZERO);
                BigDecimal difference = periodChange.subtract(referenceChange);
                BigDecimal differencePercent = referenceChange.compareTo(BigDecimal.ZERO) == 0
                        ? null
                        : difference.multiply(BigDecimal.valueOf(100))
                                .divide(referenceChange.abs(), 4, RoundingMode.HALF_UP);
                entries.add(new ReportBillingPeriodComparisonCache(
                        owner, periodIndex, period.periodStart(), period.periodEnd(),
                        referencePeriod.periodStart(), referencePeriod.periodEnd(),
                        currencyCode, periodChange, referenceChange, difference, differencePercent
                ));
            }
        }
        billingPeriodComparisonCacheRepository.saveAll(entries);
    }

    private List<CompletedBillingPeriod> completedBillingPeriodsFromFinalSnapshots(
            List<AccountSnapshot> snapshots,
            int billingMonthEndDay
    ) {
        LocalDate today = LocalDate.now(clock);
        Map<PeriodKey, Map<String, BigDecimal>> changesByPeriod = new java.util.TreeMap<>(
                Comparator.comparing(PeriodKey::periodEnd).thenComparing(PeriodKey::periodStart)
        );
        Map<PeriodKey, Set<String>> currenciesByPeriod = new HashMap<>();
        Map<String, AccountSnapshot> previousFinalByAccount = new HashMap<>();

        snapshots.stream()
                .filter(snapshot -> snapshot.getSnapshotType() == SnapshotType.FINAL)
                .filter(snapshot -> snapshot.getAccount().isShowInSnapshots())
                .sorted(Comparator.comparing(AccountSnapshot::getSnapshotDate))
                .forEach(snapshot -> {
                    PeriodKey period = resolveBillingPeriod(snapshot.getSnapshotDate(), billingMonthEndDay);
                    if (!period.periodEnd().isBefore(today)) {
                        return;
                    }

                    String accountKey = snapshot.getAccount().getId() + "|" + snapshot.getAccount().getCurrencyCode();
                    AccountSnapshot previousFinal = previousFinalByAccount.put(accountKey, snapshot);
                    if (previousFinal == null) {
                        return;
                    }

                    changesByPeriod.computeIfAbsent(period, ignored -> new HashMap<>());
                    currenciesByPeriod.computeIfAbsent(period, ignored -> new TreeSet<>())
                            .add(snapshot.getAccount().getCurrencyCode());
                    BigDecimal diff = snapshot.getBalance().subtract(previousFinal.getBalance());
                    if (diff.compareTo(BigDecimal.ZERO) == 0) {
                        return;
                    }

                    changesByPeriod.get(period).merge(snapshot.getAccount().getCurrencyCode(), diff, BigDecimal::add);
                });

        return changesByPeriod.entrySet().stream()
                .sorted(Comparator
                        .<Map.Entry<PeriodKey, Map<String, BigDecimal>>, LocalDate>comparing(entry -> entry.getKey().periodEnd())
                        .reversed()
                        .thenComparing(entry -> entry.getKey().periodStart(), Comparator.reverseOrder()))
                .limit(MAX_BILLING_COMPARISON_PERIODS + 1L)
                .map(entry -> new CompletedBillingPeriod(
                        entry.getKey().periodStart(),
                        entry.getKey().periodEnd(),
                        currenciesByPeriod.getOrDefault(entry.getKey(), Set.of()),
                        entry.getValue()
                ))
                .toList();
    }

    private PeriodKey resolveBillingPeriod(LocalDate snapshotDate, int billingMonthEndDay) {
        LocalDate periodStart = resolvePeriodStart(snapshotDate, billingMonthEndDay);
        return new PeriodKey(periodStart, resolvePeriodEnd(periodStart, billingMonthEndDay));
    }

    private LocalDate resolvePeriodEnd(LocalDate periodStart, int billingMonthEndDay) {
        LocalDate currentMonthEnd = periodStart.withDayOfMonth(Math.min(billingMonthEndDay, periodStart.lengthOfMonth()));
        if (!currentMonthEnd.isBefore(periodStart)) {
            return currentMonthEnd;
        }

        LocalDate nextMonth = periodStart.plusMonths(1);
        return nextMonth.withDayOfMonth(Math.min(billingMonthEndDay, nextMonth.lengthOfMonth()));
    }

    private Map<String, BigDecimal> balancesByCurrency(UUID ownerId, LocalDate date) {
        Map<String, BigDecimal> result = new HashMap<>();
        dailyBalanceCacheRepository
                .findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateOrderByAccountNameAsc(ownerId, date)
                .forEach(row -> result.merge(row.getCurrencyCode(), row.getBalance(), BigDecimal::add));
        return result;
    }

    private int parseBillingMonthEndDay(String value) {
        try {
            int day = Integer.parseInt(value);
            return Math.max(1, Math.min(day, 31));
        } catch (NumberFormatException ignored) {
            return 1;
        }
    }

    private LocalDate resolvePeriodStart(LocalDate date, int billingMonthEndDay) {
        LocalDate currentMonthEnd = date.withDayOfMonth(Math.min(billingMonthEndDay, date.lengthOfMonth()));
        if (date.isAfter(currentMonthEnd)) {
            return currentMonthEnd.plusDays(1);
        }
        LocalDate previousMonth = date.minusMonths(1);
        return previousMonth.withDayOfMonth(Math.min(billingMonthEndDay, previousMonth.lengthOfMonth())).plusDays(1);
    }

    private void rebuildAverageContributions(AppUser owner, List<AccountSnapshot> snapshots) {
        averageContributionCacheRepository.deleteByOwnerId(owner.getId());
        averageContributionCacheRepository.flush();

        Map<UUID, List<AccountSnapshot>> finalSnapshotsByAccountId = new HashMap<>();
        snapshots.stream()
                .filter(snapshot -> snapshot.getSnapshotType() == SnapshotType.FINAL)
                .forEach(snapshot -> finalSnapshotsByAccountId
                        .computeIfAbsent(snapshot.getAccount().getId(), ignored -> new ArrayList<>())
                        .add(snapshot));

        List<ReportAverageContributionCache> entries = new ArrayList<>();
        finalSnapshotsByAccountId.values().forEach(accountSnapshots -> {
            accountSnapshots.sort(Comparator.comparing(AccountSnapshot::getSnapshotDate));
            if (accountSnapshots.size() < 2) {
                return;
            }

            List<AccountSnapshot> sample = accountSnapshots.subList(Math.max(0, accountSnapshots.size() - 3), accountSnapshots.size());
            BigDecimal totalChange = BigDecimal.ZERO;
            for (int index = 1; index < sample.size(); index += 1) {
                totalChange = totalChange.add(sample.get(index).getBalance().subtract(sample.get(index - 1).getBalance()));
            }

            BigDecimal averageContribution = totalChange.divide(BigDecimal.valueOf(sample.size() - 1L), 4, java.math.RoundingMode.HALF_UP);
            AccountSnapshot latestSnapshot = sample.get(sample.size() - 1);
            entries.add(new ReportAverageContributionCache(
                    owner,
                    latestSnapshot.getAccount(),
                    latestSnapshot.getAccount().getBank(),
                    latestSnapshot.getAccount().getName(),
                    latestSnapshot.getAccount().getBank().getName(),
                    latestSnapshot.getAccount().getCurrencyCode(),
                    averageContribution,
                    sample.get(0).getSnapshotDate(),
                    latestSnapshot.getSnapshotDate()
            ));
        });

        averageContributionCacheRepository.saveAll(entries);
    }

    private void rebuildFinalSnapshots(AppUser owner, List<AccountSnapshot> snapshots) {
        finalSnapshotCacheRepository.deleteByOwnerId(owner.getId());
        finalSnapshotCacheRepository.flush();

        List<ReportFinalSnapshotCache> entries = snapshots.stream()
                .filter(snapshot -> snapshot.getSnapshotType() == SnapshotType.FINAL)
                .map(snapshot -> new ReportFinalSnapshotCache(
                        owner,
                        snapshot.getAccount(),
                        snapshot.getAccount().getBank(),
                        snapshot.getSnapshotDate(),
                        snapshot.getAccount().getName(),
                        snapshot.getAccount().getBank().getName(),
                        snapshot.getAccount().getCurrencyCode(),
                        snapshot.getBalance()
                ))
                .toList();

        finalSnapshotCacheRepository.saveAll(entries);
    }

    private record CompletedBillingPeriod(
            LocalDate periodStart,
            LocalDate periodEnd,
            Set<String> currencies,
            Map<String, BigDecimal> changes
    ) {
    }

    private record PeriodKey(
            LocalDate periodStart,
            LocalDate periodEnd
    ) {
    }
}
