package com.moneysnapshot.report;

import com.moneysnapshot.dashboard.SnapshotPanelService;
import com.moneysnapshot.security.CurrentUserService;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ReportCacheMaintenanceService {

    private final CurrentUserService currentUserService;
    private final ReportCacheRefreshService reportCacheRefreshService;
    private final ReportPdfService reportPdfService;
    private final SnapshotPanelService snapshotPanelService;

    public ReportCacheMaintenanceService(
            CurrentUserService currentUserService,
            ReportCacheRefreshService reportCacheRefreshService,
            ReportPdfService reportPdfService,
            SnapshotPanelService snapshotPanelService
    ) {
        this.currentUserService = currentUserService;
        this.reportCacheRefreshService = reportCacheRefreshService;
        this.reportPdfService = reportPdfService;
        this.snapshotPanelService = snapshotPanelService;
    }

    public void clearCurrentUserCache() {
        UUID ownerId = currentUserService.currentUserId();
        reportPdfService.clearCache();
        snapshotPanelService.clearOwner(ownerId);
        reportCacheRefreshService.clearOwner(ownerId);
        reportCacheRefreshService.refreshOwner(ownerId);
    }
}
