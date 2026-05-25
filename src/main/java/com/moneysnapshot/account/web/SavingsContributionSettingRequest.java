package com.moneysnapshot.account.web;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record SavingsContributionSettingRequest(
        @NotNull
        UUID accountId,

        @Digits(integer = 17, fraction = 2)
        BigDecimal forecastedMonthlyContribution
) {
}
