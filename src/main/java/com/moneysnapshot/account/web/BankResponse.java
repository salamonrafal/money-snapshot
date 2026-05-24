package com.moneysnapshot.account.web;

import com.moneysnapshot.account.Bank;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BankResponse(
        UUID id,
        String name,
        String normalizedName,
        String ownerName,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static BankResponse from(Bank bank) {
        String ownerName = bank.getOwner() == null
                ? null
                : bank.getOwner().getFirstName() + " " + bank.getOwner().getLastName();
        return new BankResponse(
                bank.getId(),
                bank.getName(),
                bank.getNormalizedName(),
                ownerName,
                bank.getCreatedAt(),
                bank.getUpdatedAt()
        );
    }
}
