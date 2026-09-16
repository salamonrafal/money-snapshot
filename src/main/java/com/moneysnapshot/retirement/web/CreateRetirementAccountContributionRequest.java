package com.moneysnapshot.retirement.web;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateRetirementAccountContributionRequest(
        @NotNull
        @DecimalMin("0.00")
        @Digits(integer = 15, fraction = 4)
        BigDecimal currentBalance,

        @NotNull
        LocalDate contributionDate,

        @Size(max = 500)
        String note
) {
}
