package com.moneysnapshot.report;

import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.AppUserRepository;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
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
    void ensureOwnerCacheReadyLocksOwnerRowBeforeRefreshing() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        ReportCacheRefreshState state = mock(ReportCacheRefreshState.class);

        when(appUserRepository.findByIdForUpdate(ownerId)).thenReturn(Optional.of(owner));
        when(refreshStateRepository.findByOwnerId(ownerId)).thenReturn(Optional.of(state));
        when(state.isDirty()).thenReturn(true);
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId)).thenReturn(List.of());
        when(owner.getId()).thenReturn(ownerId);

        service.ensureOwnerCacheReady(ownerId, java.time.LocalDate.of(2026, 6, 3));

        verify(appUserRepository).findByIdForUpdate(ownerId);
        verify(snapshotRepository).findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId);
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
