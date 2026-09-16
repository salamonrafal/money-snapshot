package com.moneysnapshot.retirement.web;

import com.moneysnapshot.retirement.RetirementAccountStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateRetirementAccountRequest(
        @NotBlank
        @Size(max = 40)
        String accountTypeCode,

        @NotBlank
        @Size(max = 120)
        String institution,

        @NotBlank
        @Size(max = 120)
        String accountName,

        @Size(max = 2048)
        String websiteUrl,

        @Pattern(regexp = "[A-Za-z]{3}")
        String currencyCode,

        @NotNull
        @DecimalMin("0.00")
        @Digits(integer = 15, fraction = 4)
        BigDecimal balance,

        @DecimalMin("0.00")
        @Digits(integer = 15, fraction = 4)
        BigDecimal monthlyContribution,

        @NotNull
        LocalDate balanceUpdatedAt,

        RetirementAccountStatus status
) {
}
