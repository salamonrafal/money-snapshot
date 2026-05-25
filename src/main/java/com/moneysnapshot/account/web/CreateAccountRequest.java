package com.moneysnapshot.account.web;

import com.moneysnapshot.account.AccountStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateAccountRequest(
        @NotBlank
        @Size(max = 120)
        String bankName,

        @NotBlank
        @Size(max = 120)
        String accountName,

        @NotBlank
        @Size(max = 40)
        String accountTypeCode,

        @NotBlank
        @Pattern(regexp = "[A-Za-z]{3}")
        String currencyCode,

        @Size(max = 500)
        String description,

        @Digits(integer = 17, fraction = 2)
        BigDecimal forecastedMonthlyContribution,

        AccountStatus status
) {
}
