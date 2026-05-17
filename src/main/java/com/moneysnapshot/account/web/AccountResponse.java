package com.moneysnapshot.account.web;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AccountResponse(
        UUID id,
        UUID bankId,
        String bankName,
        String accountName,
        String normalizedName,
        String accountTypeCode,
        String currencyCode,
        String description,
        AccountStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static AccountResponse from(Account account) {
        return new AccountResponse(
                account.getId(),
                account.getBank().getId(),
                account.getBank().getName(),
                account.getName(),
                account.getNormalizedName(),
                account.getAccountTypeCode(),
                account.getCurrencyCode(),
                account.getDescription(),
                account.getStatus(),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }
}
