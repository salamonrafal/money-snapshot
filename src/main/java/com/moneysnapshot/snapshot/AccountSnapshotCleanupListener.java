package com.moneysnapshot.snapshot;

import com.moneysnapshot.account.AccountDeletionRequestedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
public class AccountSnapshotCleanupListener {

    private final AccountSnapshotRepository snapshotRepository;

    public AccountSnapshotCleanupListener(AccountSnapshotRepository snapshotRepository) {
        this.snapshotRepository = snapshotRepository;
    }

    @Order(10)
    @EventListener
    public void onAccountDeletionRequested(AccountDeletionRequestedEvent event) {
        snapshotRepository.deleteByAccountId(event.accountId());
    }
}
