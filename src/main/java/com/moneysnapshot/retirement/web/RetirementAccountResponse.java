package com.moneysnapshot.retirement.web;

import com.moneysnapshot.retirement.RetirementAccount;
import com.moneysnapshot.retirement.RetirementAccountStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RetirementAccountResponse(
        UUID id,
        String accountTypeCode,
        String institution,
        String accountName,
        String normalizedName,
        String websiteUrl,
        String currencyCode,
        BigDecimal balance,
        BigDecimal monthlyContribution,
        LocalDate balanceUpdatedAt,
        RetirementAccountStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static RetirementAccountResponse from(RetirementAccount account) {
        return new RetirementAccountResponse(
                account.getId(),
                account.getAccountTypeCode(),
                account.getInstitution(),
                account.getName(),
                account.getNormalizedName(),
                account.getWebsiteUrl(),
                account.getCurrencyCode(),
                account.getBalance(),
                account.getMonthlyContribution(),
                account.getBalanceUpdatedAt(),
                account.getStatus(),
                account.getCreatedAt(),
                account.getUpdatedAt()
        );
    }
}
