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
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.snapshot.web.CreateAccountSnapshotRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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
    private final AccountSnapshotService snapshotService = new AccountSnapshotService(
            snapshotRepository,
            accountRepository,
            eventPublisher,
            currentUserService
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
                "first"
        );
        CreateAccountSnapshotRequest duplicateRequest = new CreateAccountSnapshotRequest(
                accountId,
                snapshotDate,
                new BigDecimal("200.00"),
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
}
