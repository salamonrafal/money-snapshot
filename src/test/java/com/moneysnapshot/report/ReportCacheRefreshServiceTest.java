package com.moneysnapshot.report;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.AppUserRepository;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.snapshot.SnapshotType;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionOperations;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReportCacheRefreshServiceTest {

    private final ReportCacheRefreshStateRepository refreshStateRepository = mock(ReportCacheRefreshStateRepository.class);
    private final ReportDailyBalanceCacheRepository dailyBalanceCacheRepository = mock(ReportDailyBalanceCacheRepository.class);
    private final ReportAverageContributionCacheRepository averageContributionCacheRepository = mock(ReportAverageContributionCacheRepository.class);
    private final ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository = mock(ReportFinalSnapshotCacheRepository.class);
    private final AppUserRepository appUserRepository = mock(AppUserRepository.class);
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

        service = new ReportCacheRefreshService(
                refreshStateRepository,
                dailyBalanceCacheRepository,
                averageContributionCacheRepository,
                finalSnapshotCacheRepository,
                appUserRepository,
                snapshotRepository,
                failureStateTransaction,
                Clock.fixed(Instant.parse("2026-06-03T00:00:00Z"), ZoneOffset.UTC)
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
