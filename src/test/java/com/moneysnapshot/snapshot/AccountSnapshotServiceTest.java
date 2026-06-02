package com.moneysnapshot.snapshot;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.report.ReportCacheRefreshService;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.snapshot.web.CreateAccountSnapshotRequest;
import com.moneysnapshot.snapshot.web.UpdateSnapshotTypeRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class AccountSnapshotServiceTest {

    private final AccountSnapshotRepository snapshotRepository = mock(AccountSnapshotRepository.class);
    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final ReportCacheRefreshService reportCacheRefreshService = mock(ReportCacheRefreshService.class);
    private final AccountSnapshotService snapshotService = new AccountSnapshotService(
            snapshotRepository,
            accountRepository,
            eventPublisher,
            currentUserService,
            reportCacheRefreshService
    );

    @Test
    void createSnapshotsRejectsDuplicateEntriesBeforeSavingBatch() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate snapshotDate = LocalDate.of(2026, 5, 19);
        Account account = mock(Account.class);
        CreateAccountSnapshotRequest firstRequest = new CreateAccountSnapshotRequest(
                accountId,
                snapshotDate,
                new BigDecimal("100.00"),
                SnapshotType.FINAL,
                "first"
        );
        CreateAccountSnapshotRequest duplicateRequest = new CreateAccountSnapshotRequest(
                accountId,
                snapshotDate,
                new BigDecimal("200.00"),
                SnapshotType.PARTIAL,
                "second"
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(snapshotRepository.existsByAccountIdAndSnapshotDate(accountId, snapshotDate)).thenReturn(false);

        assertThrows(
                DuplicateAccountSnapshotException.class,
                () -> snapshotService.createSnapshots(List.of(firstRequest, duplicateRequest))
        );

        verify(snapshotRepository, never()).saveAll(anyList());
        verify(eventPublisher, never()).publishEvent(any(AccountSnapshotCreatedEvent.class));
    }

    @Test
    void updateSnapshotTypeOnlyChangesType() {
        UUID ownerId = UUID.randomUUID();
        UUID snapshotId = UUID.randomUUID();
        Account account = mock(Account.class);
        AccountSnapshot snapshot = new AccountSnapshot(
                account,
                null,
                LocalDate.of(2026, 5, 19),
                new BigDecimal("123.45"),
                "note",
                SnapshotType.PARTIAL
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(snapshotRepository.findByIdAndOwnerIdWithAccount(snapshotId, ownerId)).thenReturn(Optional.of(snapshot));
        when(snapshotRepository.save(snapshot)).thenReturn(snapshot);

        AccountSnapshot updatedSnapshot = snapshotService.updateSnapshotType(
                snapshotId,
                new UpdateSnapshotTypeRequest(SnapshotType.FINAL)
        );

        verify(snapshotRepository).save(snapshot);
        verify(eventPublisher).publishEvent(any(AccountSnapshotCreatedEvent.class));
        org.junit.jupiter.api.Assertions.assertEquals(SnapshotType.FINAL, updatedSnapshot.getSnapshotType());
        org.junit.jupiter.api.Assertions.assertEquals(new BigDecimal("123.45"), updatedSnapshot.getBalance());
        org.junit.jupiter.api.Assertions.assertEquals("note", updatedSnapshot.getNote());
    }

    @Test
    void listSnapshotsWithoutFiltersUsesOwnerQuery() {
        UUID ownerId = UUID.randomUUID();

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(ownerId)).thenReturn(List.of());

        snapshotService.listSnapshots(null, null);

        verify(snapshotRepository).findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(ownerId);
        verify(snapshotRepository, never()).findAllByAccountIdAndOwnerIdWithAccountOrderBySnapshotDateDesc(any(), any());
        verify(snapshotRepository, never()).findAllByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(any(), any());
        verify(snapshotRepository, never()).findAllByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(any(), any(), any());
    }

    @Test
    void listSnapshotsWithAccountFilterUsesAccountQuery() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(snapshotRepository.findAllByAccountIdAndOwnerIdWithAccountOrderBySnapshotDateDesc(accountId, ownerId)).thenReturn(List.of());

        snapshotService.listSnapshots(accountId, null);

        verify(snapshotRepository).findAllByAccountIdAndOwnerIdWithAccountOrderBySnapshotDateDesc(accountId, ownerId);
        verify(snapshotRepository, never()).findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(any());
        verify(snapshotRepository, never()).findAllByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(any(), any());
        verify(snapshotRepository, never()).findAllByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(any(), any(), any());
    }

    @Test
    void listSnapshotsWithDateFilterUsesDateQuery() {
        UUID ownerId = UUID.randomUUID();
        LocalDate snapshotDate = LocalDate.of(2026, 5, 19);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(snapshotRepository.findAllByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(ownerId, snapshotDate)).thenReturn(List.of());

        snapshotService.listSnapshots(null, snapshotDate);

        verify(snapshotRepository).findAllByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(ownerId, snapshotDate);
        verify(snapshotRepository, never()).findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(any());
        verify(snapshotRepository, never()).findAllByAccountIdAndOwnerIdWithAccountOrderBySnapshotDateDesc(any(), any());
        verify(snapshotRepository, never()).findAllByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(any(), any(), any());
    }

    @Test
    void listSnapshotsWithAccountAndDateFiltersUsesCombinedQuery() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate snapshotDate = LocalDate.of(2026, 5, 19);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(snapshotRepository.findAllByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
                accountId,
                ownerId,
                snapshotDate
        )).thenReturn(List.of());

        snapshotService.listSnapshots(accountId, snapshotDate);

        verify(snapshotRepository).findAllByAccountIdAndOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(
                accountId,
                ownerId,
                snapshotDate
        );
        verify(snapshotRepository, never()).findAllByOwnerIdWithAccountOrderBySnapshotDateDesc(any());
        verify(snapshotRepository, never()).findAllByAccountIdAndOwnerIdWithAccountOrderBySnapshotDateDesc(any(), any());
        verify(snapshotRepository, never()).findAllByOwnerIdAndSnapshotDateWithAccountOrderBySnapshotDateDesc(any(), any());
    }
}
