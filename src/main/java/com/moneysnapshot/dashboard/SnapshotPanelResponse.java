package com.moneysnapshot.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SnapshotPanelResponse(
        LocalDate periodDate,
        BigDecimal monthlyChangePercent,
        long trackedAccounts,
        List<SnapshotPanelAmountResponse> currentBalances,
        List<SnapshotPanelAmountResponse> monthlyChanges,
        List<SnapshotPanelChartPointResponse> chartPoints
) {
}
