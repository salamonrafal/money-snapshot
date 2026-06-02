package com.moneysnapshot.report.web;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record HistoryReportResponse(
        List<Account> accounts,
        List<Row> rows,
        int page,
        int pageSize,
        int totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
    public record Account(UUID id, String accountName, String bankName, String currencyCode) {
    }

    public record Row(LocalDate date, List<Value> values) {
    }

    public record Value(BigDecimal balance, BigDecimal diff) {
    }
}
