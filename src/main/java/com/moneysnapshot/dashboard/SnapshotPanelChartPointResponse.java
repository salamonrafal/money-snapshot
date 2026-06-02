package com.moneysnapshot.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SnapshotPanelChartPointResponse(
        LocalDate date,
        BigDecimal amount,
        String currencyCode,
        String type
) {
}
