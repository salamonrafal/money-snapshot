package com.moneysnapshot.report.web;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record PlanningReportResponse(
        List<Row> rows,
        List<Total> totals
) {
    public record Row(
            UUID accountId,
            String name,
            String bankName,
            String currencyCode,
            BigDecimal averageContribution,
            BigDecimal currentBalance,
            BigDecimal currentPlannedBalance,
            BigDecimal currentDifferenceToPlan,
            BigDecimal projectedBalance,
            BigDecimal yearlyChange,
            BigDecimal projectedChangePercent,
            BigDecimal plannedBalance,
            BigDecimal differenceToPlan
    ) {
    }

    public record Total(
            String currencyCode,
            BigDecimal currentBalance,
            BigDecimal currentPlannedBalance,
            BigDecimal currentDifferenceToPlan,
            BigDecimal averageContribution,
            BigDecimal projectedBalance,
            BigDecimal yearlyChange,
            BigDecimal projectedChangePercent,
            BigDecimal plannedBalance,
            BigDecimal differenceToPlan
    ) {
    }
}
