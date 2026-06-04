package com.moneysnapshot.report;

import com.moneysnapshot.account.AccountChangedEvent;
import com.moneysnapshot.account.BankChangedEvent;
import com.moneysnapshot.savings.SavingsForecastChangedEvent;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ReportCacheRefreshCoordinator {

    private static final Logger log = LoggerFactory.getLogger(ReportCacheRefreshCoordinator.class);

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
            try {
                reportCacheRefreshService.refreshOwner(ownerId);
            } catch (RuntimeException exception) {
                log.warn("Failed to refresh report cache for dirty owner {}", ownerId, exception);
            }
        }
    }

    private void refreshOwnerCache(UUID ownerId) {
        reportCacheRefreshService.markDirty(ownerId);
        try {
            reportCacheRefreshService.refreshOwner(ownerId);
        } catch (RuntimeException exception) {
            log.warn("Failed to refresh report cache after owner change event for owner {}", ownerId, exception);
        }
    }
}
