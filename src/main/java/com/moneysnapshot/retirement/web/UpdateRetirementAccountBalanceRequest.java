package com.moneysnapshot.retirement.web;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateRetirementAccountBalanceRequest(
        @NotNull
        @DecimalMin("0.00")
        @Digits(integer = 15, fraction = 4)
        BigDecimal balance,

        @NotNull
        LocalDate balanceUpdatedAt
) {
}
