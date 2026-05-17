package com.moneysnapshot.account.web;

import com.moneysnapshot.account.AccountStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

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

        AccountStatus status
) {
}
