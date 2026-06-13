package com.moneysnapshot.liability.web;

import java.math.BigDecimal;
import java.time.LocalDate;

public record LiabilitySummaryResponse(
        int activeCount,
        BigDecimal monthlyDueAmount,
        BigDecimal currentDebtAmount,
        LocalDate nextPaymentDate
) {
}
