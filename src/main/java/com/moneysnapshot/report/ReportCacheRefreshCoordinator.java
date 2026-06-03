package com.moneysnapshot.report;

import com.moneysnapshot.account.AccountChangedEvent;
import com.moneysnapshot.account.BankChangedEvent;
import com.moneysnapshot.savings.SavingsForecastChangedEvent;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ReportCacheRefreshCoordinator {

    private final ReportCacheRefreshService reportCacheRefreshService;

    public ReportCacheRefreshCoordinator(ReportCacheRefreshService reportCacheRefreshService) {
        this.reportCacheRefreshService = reportCacheRefreshService;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onAccountChanged(AccountChangedEvent event) {
        refreshOwnerCache(event.ownerId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBankChanged(BankChangedEvent event) {
        refreshOwnerCache(event.ownerId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onForecastChanged(SavingsForecastChangedEvent event) {
        refreshOwnerCache(event.ownerId());
    }

    @Scheduled(fixedDelay = 30000L, initialDelay = 10000L)
    public void refreshDirtyOwners() {
        for (UUID ownerId : reportCacheRefreshService.findDirtyOwners(20)) {
            reportCacheRefreshService.refreshOwner(ownerId);
        }
    }

    private void refreshOwnerCache(UUID ownerId) {
        reportCacheRefreshService.markDirty(ownerId);
        reportCacheRefreshService.refreshOwner(ownerId);
    }
}
