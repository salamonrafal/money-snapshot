package com.moneysnapshot.report.web;

import java.math.BigDecimal;
import java.util.List;

public record RetirementCapitalReportResponse(List<Row> rows) {
    public record Row(String name, String currencyCode, BigDecimal balance, BigDecimal sharePercent) {}
}
