package com.moneysnapshot.snapshot.web;

import com.moneysnapshot.snapshot.AccountSnapshot;
import com.moneysnapshot.snapshot.SnapshotType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AccountSnapshotResponse(
        UUID id,
        UUID accountId,
        String accountName,
        String bankName,
        String currencyCode,
        LocalDate snapshotDate,
        BigDecimal balance,
        SnapshotType snapshotType,
        String note,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static AccountSnapshotResponse from(AccountSnapshot snapshot) {
        return new AccountSnapshotResponse(
                snapshot.getId(),
                snapshot.getAccount().getId(),
                snapshot.getAccount().getName(),
                snapshot.getAccount().getBank().getName(),
                snapshot.getAccount().getCurrencyCode(),
                snapshot.getSnapshotDate(),
                snapshot.getBalance(),
                snapshot.getSnapshotType(),
                snapshot.getNote(),
                snapshot.getCreatedAt(),
                snapshot.getUpdatedAt()
        );
    }
}
