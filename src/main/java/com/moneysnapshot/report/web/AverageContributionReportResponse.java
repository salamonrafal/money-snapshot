package com.moneysnapshot.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record AverageContributionReportResponse(
        List<Row> rows,
        List<Total> totals
) {
    public record Row(
            UUID accountId,
            String name,
            String bankName,
            String currencyCode,
            BigDecimal averageContribution,
            LocalDate sampleFromDate,
            LocalDate sampleToDate
    ) {
    }

    public record Total(String currencyCode, BigDecimal averageContribution) {
    }
}
