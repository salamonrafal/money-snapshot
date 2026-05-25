package com.moneysnapshot.account.web;

import com.moneysnapshot.account.Account;
import java.math.BigDecimal;
import java.util.UUID;

public record SavingsContributionSettingResponse(
        UUID accountId,
        String accountName,
        String bankName,
        String currencyCode,
        BigDecimal forecastedMonthlyContribution
) {

    public static SavingsContributionSettingResponse from(Account account) {
        return new SavingsContributionSettingResponse(
                account.getId(),
                account.getName(),
                account.getBank().getName(),
                account.getCurrencyCode(),
                account.getForecastedMonthlyContribution()
        );
    }
}
