package com.moneysnapshot.counterparty.web;

import com.moneysnapshot.counterparty.Counterparty;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CounterpartyResponse(
        UUID id,
        String name,
        String normalizedName,
        String bankAccountNumber,
        String address,
        String note,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static CounterpartyResponse from(Counterparty counterparty) {
        return new CounterpartyResponse(
                counterparty.getId(),
                counterparty.getName(),
                counterparty.getNormalizedName(),
                counterparty.getBankAccountNumber(),
                counterparty.getAddress(),
                counterparty.getNote(),
                counterparty.getCreatedAt(),
                counterparty.getUpdatedAt()
        );
    }
}
