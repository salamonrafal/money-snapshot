package com.moneysnapshot.savings.web;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SavingsForecastMonthValueResponse(
        LocalDate forecastMonth,
        BigDecimal balance
) {
}
