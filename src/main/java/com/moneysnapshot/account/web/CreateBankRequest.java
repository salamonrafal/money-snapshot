package com.moneysnapshot.account.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateBankRequest(
        @NotBlank
        @Size(max = 120)
        String name
) {
}
