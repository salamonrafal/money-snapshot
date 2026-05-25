package com.moneysnapshot.account.web;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AccountResponse(
        UUID id,
        UUID bankId,
        String bankName,
        String accountName,
        String normalizedName,
        String ownerName,
        String accountTypeCode,
        String currencyCode,
        String description,
        BigDecimal forecastedMonthlyContribution,
        AccountStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static AccountResponse from(Account account) {
        String ownerName = account.getOwner() == null
                ? null
                : account.getOwner().getFirstName() + " " + account.getOwner().getLastName();
        return new AccountResponse(
                account.getId(),
                account.getBank().getId(),
                account.getBank().getName(),
                account.getName(),
                account.getNormalizedName(),
                ownerName,
                account.getAccountTypeCode(),
                account.getCurrencyCode(),
                account.getDescription(),
                account.getForecastedMonthlyContribution(),
                account.getStatus(),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }
}
