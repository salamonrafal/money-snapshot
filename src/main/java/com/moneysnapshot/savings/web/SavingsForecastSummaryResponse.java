package com.moneysnapshot.savings.web;

import com.moneysnapshot.savings.SavingsForecastMonthSummary;
import java.math.BigDecimal;
import java.time.LocalDate;

public record SavingsForecastSummaryResponse(
        LocalDate forecastMonth,
        String currencyCode,
        BigDecimal totalBalance
) {

    public static SavingsForecastSummaryResponse from(SavingsForecastMonthSummary summary) {
        return new SavingsForecastSummaryResponse(
                summary.getForecastMonth(),
                summary.getCurrencyCode(),
                summary.getTotalBalance()
        );
    }
}
