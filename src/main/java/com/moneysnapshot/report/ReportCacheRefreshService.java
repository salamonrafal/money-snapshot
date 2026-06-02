package com.moneysnapshot.report;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.AppUserRepository;
import com.moneysnapshot.snapshot.AccountSnapshot;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.snapshot.SnapshotType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportCacheRefreshService {

    private static final Logger log = LoggerFactory.getLogger(ReportCacheRefreshService.class);

    private final ReportCacheRefreshStateRepository refreshStateRepository;
    private final ReportDailyBalanceCacheRepository dailyBalanceCacheRepository;
    private final ReportAverageContributionCacheRepository averageContributionCacheRepository;
    private final ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository;
    private final AppUserRepository appUserRepository;
    private final AccountSnapshotRepository snapshotRepository;
    private final Clock clock;

    @Autowired
    public ReportCacheRefreshService(
            ReportCacheRefreshStateRepository refreshStateRepository,
            ReportDailyBalanceCacheRepository dailyBalanceCacheRepository,
            ReportAverageContributionCacheRepository averageContributionCacheRepository,
            ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository,
            AppUserRepository appUserRepository,
            AccountSnapshotRepository snapshotRepository
    ) {
        this(
                refreshStateRepository,
                dailyBalanceCacheRepository,
                averageContributionCacheRepository,
                finalSnapshotCacheRepository,
                appUserRepository,
                snapshotRepository,
                Clock.systemUTC()
        );
    }

    ReportCacheRefreshService(
            ReportCacheRefreshStateRepository refreshStateRepository,
            ReportDailyBalanceCacheRepository dailyBalanceCacheRepository,
            ReportAverageContributionCacheRepository averageContributionCacheRepository,
            ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository,
            AppUserRepository appUserRepository,
            AccountSnapshotRepository snapshotRepository,
            Clock clock
    ) {
        this.refreshStateRepository = refreshStateRepository;
        this.dailyBalanceCacheRepository = dailyBalanceCacheRepository;
        this.averageContributionCacheRepository = averageContributionCacheRepository;
        this.finalSnapshotCacheRepository = finalSnapshotCacheRepository;
        this.appUserRepository = appUserRepository;
        this.snapshotRepository = snapshotRepository;
        this.clock = clock;
    }

    @Transactional
    public void ensureRefreshStatesExist() {
        List<AppUser> users = appUserRepository.findAllByOrderByEmail();
        users.forEach(user -> refreshStateRepository.findByOwnerId(user.getId())
                .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(user.getId()))));
    }

    @Transactional
    public void markDirty(UUID ownerId) {
        AppUser owner = appUserRepository.findById(ownerId).orElse(null);
        if (owner == null) {
            return;
        }

        ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId)
                .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(ownerId)));
        state.markDirty();
        refreshStateRepository.save(state);
    }

    public List<UUID> findDirtyOwners(int limit) {
        return refreshStateRepository.findTop20ByDirtyTrueOrderByRefreshRequestedAtAsc().stream()
                .limit(Math.max(1, limit))
                .map(ReportCacheRefreshState::getOwnerId)
                .toList();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clearOwner(UUID ownerId) {
        AppUser owner = appUserRepository.findById(ownerId).orElse(null);
        if (owner == null) {
            return;
        }

        dailyBalanceCacheRepository.deleteByOwnerId(ownerId);
        dailyBalanceCacheRepository.flush();
        averageContributionCacheRepository.deleteByOwnerId(ownerId);
        averageContributionCacheRepository.flush();
        finalSnapshotCacheRepository.deleteByOwnerId(ownerId);
        finalSnapshotCacheRepository.flush();

        ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId)
                .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(ownerId)));
        state.markDirty();
        refreshStateRepository.save(state);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureOwnerCacheReady(UUID ownerId, LocalDate requiredDate) {
        AppUser owner = appUserRepository.findById(ownerId).orElse(null);
        if (owner == null) {
            return;
        }

        ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId)
                .orElseGet(() -> refreshStateRepository.save(new ReportCacheRefreshState(ownerId)));
        boolean cacheMissing = !dailyBalanceCacheRepository.existsByOwnerIdAndBalanceDate(ownerId, requiredDate);
        boolean hasFinalSnapshots = snapshotRepository.existsByOwnerIdAndSnapshotType(ownerId, SnapshotType.FINAL);
        boolean finalCacheMissing = hasFinalSnapshots && !finalSnapshotCacheRepository.existsByOwnerId(ownerId);
        if (state.isDirty() || cacheMissing || finalCacheMissing) {
            refreshOwner(ownerId);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void refreshOwner(UUID ownerId) {
        ReportCacheRefreshState state = refreshStateRepository.findByOwnerId(ownerId).orElse(null);
        AppUser owner = appUserRepository.findById(ownerId).orElse(null);
        if (state == null || owner == null) {
            return;
        }

        try {
            List<AccountSnapshot> snapshots = snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId);
            rebuildDailyBalances(owner, snapshots);
            rebuildFinalSnapshots(owner, snapshots);
            rebuildAverageContributions(owner, snapshots);
            state.markRefreshed();
        } catch (RuntimeException exception) {
            state.markFailed(exception.getMessage());
            log.warn("Failed to refresh report cache for owner {}", ownerId, exception);
            throw exception;
        }
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
}
