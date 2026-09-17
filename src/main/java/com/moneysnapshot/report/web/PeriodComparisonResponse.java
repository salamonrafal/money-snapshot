package com.moneysnapshot.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PeriodComparisonResponse(List<Period> periods) {
    public record Period(int index, LocalDate startDate, LocalDate endDate, List<Point> points) {}
    public record Point(LocalDate date, String currencyCode, BigDecimal amount, boolean finalSnapshot) {}
}
