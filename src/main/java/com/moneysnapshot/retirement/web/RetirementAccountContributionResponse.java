package com.moneysnapshot.retirement.web;

import com.moneysnapshot.retirement.RetirementAccount;
import com.moneysnapshot.retirement.RetirementAccountContribution;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RetirementAccountContributionResponse(
        UUID id,
        UUID retirementAccountId,
        String accountTypeCode,
        String accountName,
        String currencyCode,
        BigDecimal amount,
        BigDecimal previousBalance,
        BigDecimal currentBalance,
        LocalDate contributionDate,
        String note,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static RetirementAccountContributionResponse from(RetirementAccountContribution contribution) {
        RetirementAccount account = contribution.getRetirementAccount();
        return new RetirementAccountContributionResponse(
                contribution.getId(),
                account.getId(),
                account.getAccountTypeCode(),
                account.getName(),
                account.getCurrencyCode(),
                contribution.getAmount(),
                contribution.getPreviousBalance(),
                contribution.getCurrentBalance(),
                contribution.getContributionDate(),
                contribution.getNote(),
                contribution.getCreatedAt(),
                contribution.getUpdatedAt()
        );
    }
}
