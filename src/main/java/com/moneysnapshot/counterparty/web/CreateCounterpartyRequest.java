package com.moneysnapshot.counterparty.web;

import com.moneysnapshot.shared.validation.ValidBankAccountNumber;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCounterpartyRequest(
        @NotBlank @Size(max = 180) String name,
        @NotBlank @Size(max = 64) @ValidBankAccountNumber String bankAccountNumber,
        @Size(max = 500) String address,
        @Size(max = 500) String note
) {
}
