package com.moneysnapshot.account.web;

import com.moneysnapshot.account.Bank;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BankResponse(
        UUID id,
        String name,
        String normalizedName,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static BankResponse from(Bank bank) {
        return new BankResponse(
                bank.getId(),
                bank.getName(),
                bank.getNormalizedName(),
                bank.getCreatedAt(),
                bank.getUpdatedAt()
        );
    }
}
