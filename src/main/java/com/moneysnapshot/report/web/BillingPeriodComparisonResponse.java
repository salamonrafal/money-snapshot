package com.moneysnapshot.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record BillingPeriodComparisonResponse(List<Row> rows) {
    public record Row(
            int periodIndex,
            LocalDate periodStartDate,
            LocalDate periodEndDate,
            LocalDate referenceStartDate,
            LocalDate referenceEndDate,
            String currencyCode,
            BigDecimal periodChange,
            BigDecimal referenceChange,
            BigDecimal difference,
            BigDecimal differencePercent
    ) {
    }
}
