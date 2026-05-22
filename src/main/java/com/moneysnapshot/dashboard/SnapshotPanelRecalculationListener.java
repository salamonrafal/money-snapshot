package com.moneysnapshot.dashboard;

import com.moneysnapshot.account.AccountDeletionRequestedEvent;
import com.moneysnapshot.account.BankDeletionRequestedEvent;
import com.moneysnapshot.security.UserSettingsUpdatedEvent;
import com.moneysnapshot.snapshot.AccountSnapshotCreatedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class SnapshotPanelRecalculationListener {

    private final SnapshotPanelService snapshotPanelService;

    public SnapshotPanelRecalculationListener(SnapshotPanelService snapshotPanelService) {
        this.snapshotPanelService = snapshotPanelService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccountSnapshotCreated(AccountSnapshotCreatedEvent event) {
        snapshotPanelService.recalculate();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccountDeletionRequested(AccountDeletionRequestedEvent event) {
        snapshotPanelService.recalculate();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBankDeletionRequested(BankDeletionRequestedEvent event) {
        snapshotPanelService.recalculate();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUserSettingsUpdated(UserSettingsUpdatedEvent event) {
        snapshotPanelService.recalculate();
    }
}
