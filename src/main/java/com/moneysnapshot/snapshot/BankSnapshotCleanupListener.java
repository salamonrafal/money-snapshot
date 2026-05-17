package com.moneysnapshot.snapshot;

import com.moneysnapshot.account.BankDeletionRequestedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
public class BankSnapshotCleanupListener {

    private final AccountSnapshotRepository snapshotRepository;

    public BankSnapshotCleanupListener(AccountSnapshotRepository snapshotRepository) {
        this.snapshotRepository = snapshotRepository;
    }

    @Order(10)
    @EventListener
    public void onBankDeletionRequested(BankDeletionRequestedEvent event) {
        snapshotRepository.deleteByBankId(event.bankId());
    }
}
