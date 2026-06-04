package com.moneysnapshot.report;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.AccountChangedEvent;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReportCacheRefreshCoordinatorTest {

    private final ReportCacheRefreshService reportCacheRefreshService = mock(ReportCacheRefreshService.class);
    private final ReportCacheRefreshCoordinator coordinator = new ReportCacheRefreshCoordinator(reportCacheRefreshService);

    @Test
    void refreshDirtyOwnersContinuesWhenSingleOwnerRefreshFails() {
        UUID firstOwnerId = UUID.randomUUID();
        UUID secondOwnerId = UUID.randomUUID();

        when(reportCacheRefreshService.findDirtyOwners(20)).thenReturn(List.of(firstOwnerId, secondOwnerId));
        doThrow(new RuntimeException("boom")).when(reportCacheRefreshService).refreshOwner(firstOwnerId);

        coordinator.refreshDirtyOwners();

        verify(reportCacheRefreshService).refreshOwner(firstOwnerId);
        verify(reportCacheRefreshService).refreshOwner(secondOwnerId);
    }

    @Test
    void onAccountChangedSwallowsImmediateRefreshFailure() {
        UUID ownerId = UUID.randomUUID();

        doThrow(new RuntimeException("boom")).when(reportCacheRefreshService).refreshOwner(ownerId);

        coordinator.onAccountChanged(new AccountChangedEvent(ownerId));

        verify(reportCacheRefreshService).markDirty(ownerId);
        verify(reportCacheRefreshService).refreshOwner(ownerId);
    }
}
