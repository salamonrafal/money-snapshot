package com.moneysnapshot.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SummaryReportResponse(
        List<Row> rows,
        String step,
        List<LocalDate> checkpoints
) {
    public record Row(
            String name,
            String currencyCode,
            BigDecimal startBalance,
            BigDecimal endBalance,
            BigDecimal change,
            BigDecimal changePercent,
            List<Point> points,
            List<Point> series
    ) {
    }

    public record Point(
            LocalDate date,
            BigDecimal balance,
            BigDecimal change
    ) {
    }
}
