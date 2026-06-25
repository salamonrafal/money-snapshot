package com.moneysnapshot.account.web;

import com.moneysnapshot.account.AccountStatus;
import com.moneysnapshot.shared.validation.ValidBankAccountNumber;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
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

        @Size(max = 64)
        @ValidBankAccountNumber
        String bankAccountNumber,

        @Digits(integer = 17, fraction = 2)
        BigDecimal forecastedMonthlyContribution,

        Boolean showInSnapshots,

        AccountStatus status
) {
}
