package com.moneysnapshot.report;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.AppUserRepository;
import com.moneysnapshot.security.UserSetting;
import com.moneysnapshot.security.UserSettingRepository;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.snapshot.AccountSnapshot;
import com.moneysnapshot.snapshot.SnapshotType;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReportCacheRefreshServiceTest {

    private final ReportCacheRefreshStateRepository refreshStateRepository = mock(ReportCacheRefreshStateRepository.class);
    private final ReportDailyBalanceCacheRepository dailyBalanceCacheRepository = mock(ReportDailyBalanceCacheRepository.class);
    private final ReportAverageContributionCacheRepository averageContributionCacheRepository = mock(ReportAverageContributionCacheRepository.class);
    private final ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository = mock(ReportFinalSnapshotCacheRepository.class);
    private final ReportBillingPeriodComparisonCacheRepository billingPeriodComparisonCacheRepository = mock(ReportBillingPeriodComparisonCacheRepository.class);
    private final AppUserRepository appUserRepository = mock(AppUserRepository.class);
    private final UserSettingRepository userSettingRepository = mock(UserSettingRepository.class);
    private final AccountSnapshotRepository snapshotRepository = mock(AccountSnapshotRepository.class);
    private final TransactionOperations failureStateTransaction = mock(TransactionOperations.class);

    private ReportCacheRefreshService service;

    @BeforeEach
    void setUp() {
        doAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            var action = (java.util.function.Consumer<org.springframework.transaction.TransactionStatus>) invocation.getArgument(0);
            action.accept(null);
            return null;
        }).when(failureStateTransaction).executeWithoutResult(any());

        service = createService(Clock.fixed(Instant.parse("2026-06-03T00:00:00Z"), ZoneOffset.UTC));
    }

    private ReportCacheRefreshService createService(Clock clock) {
        return new ReportCacheRefreshService(
                refreshStateRepository,
                dailyBalanceCacheRepository,
                averageContributionCacheRepository,
                finalSnapshotCacheRepository,
                billingPeriodComparisonCacheRepository,
                appUserRepository,
                userSettingRepository,
                snapshotRepository,
                failureStateTransaction,
                clock
        );
    }

    @Test
    void clearOwnerLocksOwnerRowBeforeDeletingCaches() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(owner.getId()).thenReturn(ownerId);
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));

        service.clearOwner(ownerId);

        verify(appUserRepository).findByIdForUpdate(ownerId);
        verify(dailyBalanceCacheRepository).deleteByOwnerId(ownerId);
        verify(averageContributionCacheRepository).deleteByOwnerId(ownerId);
        verify(finalSnapshotCacheRepository).deleteByOwnerId(ownerId);
        verify(billingPeriodComparisonCacheRepository).deleteByOwnerId(ownerId);
    }

    @Test
    void markDirtyLocksOwnerRowBeforeUpdatingState() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));

        service.markDirty(ownerId);

        verify(appUserRepository).findByIdForUpdate(ownerId);
        verify(state).markDirty();
        verify(refreshStateRepository).save(state);
    }

    @Test
    void markDirtyRunsInRequiresNewTransaction() throws NoSuchMethodException {
        Transactional transactional = ReportCacheRefreshService.class
                .getMethod("markDirty", UUID.class)
                .getAnnotation(Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }

    @Test
    void findDirtyOwnersReturnsEmptyListForNonPositiveLimit() {
        assertThat(service.findDirtyOwners(0)).isEmpty();
        assertThat(service.findDirtyOwners(-1)).isEmpty();

        verify(refreshStateRepository, never()).findTop20ByDirtyTrueOrderByRefreshRequestedAtAsc();
    }

    @Test
    void findDirtyOwnersCapsLimitAtRepositoryBatchSize() {
        ReportCacheRefreshState first = mock(ReportCacheRefreshState.class);
        ReportCacheRefreshState second = mock(ReportCacheRefreshState.class);
        ReportCacheRefreshState third = mock(ReportCacheRefreshState.class);
        UUID firstOwnerId = UUID.randomUUID();
        UUID secondOwnerId = UUID.randomUUID();
        UUID thirdOwnerId = UUID.randomUUID();

        when(first.getOwnerId()).thenReturn(firstOwnerId);
        when(second.getOwnerId()).thenReturn(secondOwnerId);
        when(third.getOwnerId()).thenReturn(thirdOwnerId);
        when(refreshStateRepository.findTop20ByDirtyTrueOrderByRefreshRequestedAtAsc())
                .thenReturn(List.of(first, second, third));

        assertThat(service.findDirtyOwners(50))
                .containsExactly(firstOwnerId, secondOwnerId, thirdOwnerId);
    }

    @Test
    void ensureOwnerCacheReadyLocksOwnerRowBeforeRefreshing() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(state.isDirty()).thenReturn(true);
        when(snapshotRepository.existsByOwnerId(ownerId)).thenReturn(false);
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(List.of());
        when(owner.getId()).thenReturn(ownerId);

        service.ensureOwnerCacheReady(ownerId, java.time.LocalDate.of(2026, 6, 3));

        verify(appUserRepository).findByIdForUpdate(ownerId);
        verify(snapshotRepository).findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId);
    }

    @Test
    void ensureOwnerCacheReadySkipsRefreshForCleanOwnerWithoutSnapshots() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(state.isDirty()).thenReturn(false);
        when(snapshotRepository.existsByOwnerId(ownerId)).thenReturn(false);
        when(snapshotRepository.existsByOwnerIdAndSnapshotType(ownerId, SnapshotType.FINAL)).thenReturn(false);

        service.ensureOwnerCacheReady(ownerId, java.time.LocalDate.of(2026, 6, 3));

        verify(snapshotRepository, never()).findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId);
        verify(dailyBalanceCacheRepository, never()).existsByOwnerIdAndBalanceDate(ownerId, java.time.LocalDate.of(2026, 6, 3));
        verify(finalSnapshotCacheRepository, never()).existsByOwnerId(ownerId);
    }

    @Test
    void refreshOwnerLocksOwnerRowBeforeRebuildingCaches() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(List.of());
        when(owner.getId()).thenReturn(ownerId);

        service.refreshOwner(ownerId);

        verify(appUserRepository).findByIdForUpdate(ownerId);
        verify(snapshotRepository).findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId);
    }

    @Test
    void refreshOwnerPersistsRefreshedStateAfterSuccessfulRebuild() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(List.of());
        when(owner.getId()).thenReturn(ownerId);

        service.refreshOwner(ownerId);

        verify(state).markRefreshed();
        verify(refreshStateRepository).save(state);
    }

    @Test
    void refreshOwnerCachesSixPeriodsComparedWithLatestCompletedPeriod() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UUID accountId = UUID.randomUUID();
        AccountSnapshot aprilFinal = finalSnapshot(accountId, LocalDate.of(2026, 4, 1), "80");
        AccountSnapshot mayFinal = finalSnapshot(accountId, LocalDate.of(2026, 5, 1), "100");
        AccountSnapshot juneFinal = finalSnapshot(accountId, LocalDate.of(2026, 6, 1), "140");

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(List.of(aprilFinal, mayFinal, juneFinal));

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        ReportBillingPeriodComparisonCache first = captor.getValue().get(0);
        assertThat(captor.getValue()).hasSize(1);
        assertThat(first.getPeriodStartDate()).isEqualTo(LocalDate.of(2026, 4, 2));
        assertThat(first.getPeriodEndDate()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(first.getReferenceStartDate()).isEqualTo(LocalDate.of(2026, 5, 2));
        assertThat(first.getReferenceEndDate()).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(first.getPeriodChange()).isEqualByComparingTo("20");
        assertThat(first.getReferenceChange()).isEqualByComparingTo("40");
        assertThat(first.getDifference()).isEqualByComparingTo("-20");
        assertThat(first.getDifferencePercent()).isEqualByComparingTo("-50");
    }

    @Test
    void refreshOwnerSkipsCurrencyWithoutChangeInComparedPeriods() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UUID plnAccountId = UUID.randomUUID();
        UUID usdAccountId = UUID.randomUUID();
        List<AccountSnapshot> snapshots = List.of(
                finalSnapshot(usdAccountId, LocalDate.of(2026, 1, 1), "100", "USD"),
                finalSnapshot(plnAccountId, LocalDate.of(2026, 4, 1), "80", "PLN"),
                finalSnapshot(plnAccountId, LocalDate.of(2026, 5, 1), "100", "PLN"),
                finalSnapshot(plnAccountId, LocalDate.of(2026, 6, 1), "140", "PLN")
        );

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        assertThat(captor.getValue())
                .extracting(ReportBillingPeriodComparisonCache::getCurrencyCode)
                .containsExactly("PLN");
    }

    @Test
    void refreshOwnerRejectsChangesSpanningMissingBillingPeriods() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UUID accountId = UUID.randomUUID();
        List<AccountSnapshot> snapshots = List.of(
                finalSnapshot(accountId, LocalDate.of(2026, 1, 1), "100"),
                finalSnapshot(accountId, LocalDate.of(2026, 3, 1), "130"),
                finalSnapshot(accountId, LocalDate.of(2026, 4, 1), "140"),
                finalSnapshot(accountId, LocalDate.of(2026, 5, 1), "160")
        );

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        ReportBillingPeriodComparisonCache row = captor.getValue().get(0);
        assertThat(row.getPeriodStartDate()).isEqualTo(LocalDate.of(2026, 3, 2));
        assertThat(row.getPeriodEndDate()).isEqualTo(LocalDate.of(2026, 4, 1));
        assertThat(row.getPeriodChange()).isEqualByComparingTo("10");
        assertThat(row.getReferenceStartDate()).isEqualTo(LocalDate.of(2026, 4, 2));
        assertThat(row.getReferenceEndDate()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(row.getReferenceChange()).isEqualByComparingTo("20");
    }

    @Test
    void refreshOwnerExcludesUnfinishedPeriodFromBillingComparison() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UUID accountId = UUID.randomUUID();
        AccountSnapshot aprilFinal = finalSnapshot(accountId, LocalDate.of(2026, 4, 1), "80");
        AccountSnapshot mayFinal = finalSnapshot(accountId, LocalDate.of(2026, 5, 1), "100");
        AccountSnapshot juneFinal = finalSnapshot(accountId, LocalDate.of(2026, 6, 1), "140");
        AccountSnapshot futureJulyFinal = finalSnapshot(accountId, LocalDate.of(2026, 7, 1), "200");

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId))
                .thenReturn(List.of(aprilFinal, mayFinal, juneFinal, futureJulyFinal));

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        ReportBillingPeriodComparisonCache row = captor.getValue().get(0);
        assertThat(row.getReferenceStartDate()).isEqualTo(LocalDate.of(2026, 5, 2));
        assertThat(row.getReferenceEndDate()).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(row.getReferenceChange()).isEqualByComparingTo("40");
    }

    @Test
    void refreshOwnerExcludesPeriodEndingTodayFromBillingComparison() {
        service = createService(Clock.fixed(Instant.parse("2026-07-01T00:00:00Z"), ZoneOffset.UTC));
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UUID accountId = UUID.randomUUID();
        List<AccountSnapshot> snapshots = List.of(
                finalSnapshot(accountId, LocalDate.of(2026, 4, 1), "80"),
                finalSnapshot(accountId, LocalDate.of(2026, 5, 1), "100"),
                finalSnapshot(accountId, LocalDate.of(2026, 6, 1), "140"),
                finalSnapshot(accountId, LocalDate.of(2026, 7, 1), "200")
        );

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        ReportBillingPeriodComparisonCache row = captor.getValue().get(0);
        assertThat(row.getReferenceStartDate()).isEqualTo(LocalDate.of(2026, 5, 2));
        assertThat(row.getReferenceEndDate()).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(row.getReferenceChange()).isEqualByComparingTo("40");
    }

    @Test
    void refreshOwnerSkipsEmptyBillingWindowsAndUsesConfiguredPeriodEnd() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UserSetting billingMonthEndDay = mock(UserSetting.class);
        UUID accountId = UUID.randomUUID();
        List<AccountSnapshot> snapshots = List.of(
                finalSnapshot(accountId, LocalDate.of(2025, 9, 29), "5"),
                finalSnapshot(accountId, LocalDate.of(2025, 10, 30), "10"),
                finalSnapshot(accountId, LocalDate.of(2025, 11, 29), "20"),
                finalSnapshot(accountId, LocalDate.of(2025, 12, 30), "30"),
                finalSnapshot(accountId, LocalDate.of(2026, 1, 29), "40"),
                finalSnapshot(accountId, LocalDate.of(2026, 3, 30), "60"),
                finalSnapshot(accountId, LocalDate.of(2026, 4, 29), "80"),
                finalSnapshot(accountId, LocalDate.of(2026, 5, 30), "100")
        );

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);
        when(userSettingRepository.findByUserIdAndKey(ownerId, UserSettingsService.BILLING_MONTH_START_DAY))
                .thenReturn(Optional.of(billingMonthEndDay));
        when(billingMonthEndDay.getValue()).thenReturn("31");

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(5);
        assertThat(captor.getValue())
                .extracting(ReportBillingPeriodComparisonCache::getPeriodStartDate)
                .containsExactly(
                        LocalDate.of(2026, 4, 1),
                        LocalDate.of(2026, 1, 1),
                        LocalDate.of(2025, 12, 1),
                        LocalDate.of(2025, 11, 1),
                        LocalDate.of(2025, 10, 1)
                );
        assertThat(captor.getValue())
                .extracting(ReportBillingPeriodComparisonCache::getPeriodEndDate)
                .containsExactly(
                        LocalDate.of(2026, 4, 30),
                        LocalDate.of(2026, 1, 31),
                        LocalDate.of(2025, 12, 31),
                        LocalDate.of(2025, 11, 30),
                        LocalDate.of(2025, 10, 31)
                );
        assertThat(captor.getValue())
                .extracting(ReportBillingPeriodComparisonCache::getReferenceStartDate)
                .containsOnly(LocalDate.of(2026, 5, 1));
        assertThat(captor.getValue())
                .extracting(ReportBillingPeriodComparisonCache::getReferenceEndDate)
                .containsOnly(LocalDate.of(2026, 5, 31));
    }

    @Test
    void refreshOwnerKeepsFinalSnapshotInPeriodContainingItsDate() {
        service = createService(Clock.fixed(Instant.parse("2026-08-03T00:00:00Z"), ZoneOffset.UTC));
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UUID accountId = UUID.randomUUID();
        List<AccountSnapshot> snapshots = List.of(
                finalSnapshot(accountId, LocalDate.of(2026, 5, 2), "80"),
                finalSnapshot(accountId, LocalDate.of(2026, 6, 2), "100"),
                finalSnapshot(accountId, LocalDate.of(2026, 7, 2), "140")
        );

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        ReportBillingPeriodComparisonCache row = captor.getValue().get(0);
        assertThat(row.getPeriodStartDate()).isEqualTo(LocalDate.of(2026, 6, 2));
        assertThat(row.getPeriodEndDate()).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(row.getReferenceStartDate()).isEqualTo(LocalDate.of(2026, 7, 2));
        assertThat(row.getReferenceEndDate()).isEqualTo(LocalDate.of(2026, 8, 1));
    }

    @Test
    void refreshOwnerKeepsCompletedPeriodWhenFinalExistsButChangeIsZero() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        UUID accountId = UUID.randomUUID();
        List<AccountSnapshot> snapshots = List.of(
                finalSnapshot(accountId, LocalDate.of(2026, 3, 2), "100"),
                finalSnapshot(accountId, LocalDate.of(2026, 4, 2), "100"),
                finalSnapshot(accountId, LocalDate.of(2026, 5, 2), "120")
        );

        when(owner.getId()).thenReturn(ownerId);
        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(snapshots);

        service.refreshOwner(ownerId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ReportBillingPeriodComparisonCache>> captor = ArgumentCaptor.forClass(List.class);
        verify(billingPeriodComparisonCacheRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        ReportBillingPeriodComparisonCache row = captor.getValue().get(0);
        assertThat(row.getReferenceStartDate()).isEqualTo(LocalDate.of(2026, 5, 2));
        assertThat(row.getReferenceEndDate()).isEqualTo(LocalDate.of(2026, 6, 1));
        assertThat(row.getPeriodStartDate()).isEqualTo(LocalDate.of(2026, 4, 2));
        assertThat(row.getPeriodEndDate()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(row.getPeriodChange()).isEqualByComparingTo("0");
        assertThat(row.getReferenceChange()).isEqualByComparingTo("20");
    }

    private AccountSnapshot finalSnapshot(UUID accountId, LocalDate snapshotDate, String amount) {
        return finalSnapshot(accountId, snapshotDate, amount, "PLN");
    }

    private AccountSnapshot finalSnapshot(UUID accountId, LocalDate snapshotDate, String amount, String currencyCode) {
        AccountSnapshot snapshot = mock(AccountSnapshot.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);
        when(account.getId()).thenReturn(accountId);
        when(account.getName()).thenReturn("Konto testowe");
        when(bank.getName()).thenReturn("Bank testowy");
        when(account.getBank()).thenReturn(bank);
        when(account.getCurrencyCode()).thenReturn(currencyCode);
        when(account.isShowInSnapshots()).thenReturn(true);
        when(snapshot.getAccount()).thenReturn(account);
        when(snapshot.getBalance()).thenReturn(new BigDecimal(amount));
        when(snapshot.getSnapshotDate()).thenReturn(snapshotDate);
        when(snapshot.getSnapshotType()).thenReturn(SnapshotType.FINAL);
        return snapshot;
    }

    @Test
    void refreshOwnerPersistsFailureStateBeforeRethrow() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);
        RuntimeException failure = new RuntimeException("boom");

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenThrow(failure);

        assertThatThrownBy(() -> service.refreshOwner(ownerId))
                .isSameAs(failure);

        verify(failureStateTransaction).executeWithoutResult(any());
        verify(state).markFailed("boom");
        verify(refreshStateRepository).save(state);
    }
}
