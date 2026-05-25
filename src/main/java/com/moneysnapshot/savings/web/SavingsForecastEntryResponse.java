package com.moneysnapshot.savings.web;

import com.moneysnapshot.savings.SavingsForecastEntry;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SavingsForecastEntryResponse(
        UUID accountId,
        String accountName,
        String bankName,
        String accountTypeCode,
        String currencyCode,
        LocalDate latestSnapshotDate,
        BigDecimal startingBalance,
        BigDecimal forecastedMonthlyContribution,
        BigDecimal projectedBalance,
        List<SavingsForecastMonthValueResponse> monthlyBalances
) {

    public static SavingsForecastEntryResponse from(
            SavingsForecastEntry entry,
            List<SavingsForecastMonthValueResponse> monthlyBalances
    ) {
        return new SavingsForecastEntryResponse(
                entry.getAccount().getId(),
                entry.getAccount().getName(),
                entry.getAccount().getBank().getName(),
                entry.getAccount().getAccountTypeCode(),
                entry.getAccount().getCurrencyCode(),
                entry.getLatestSnapshotDate(),
                entry.getStartingBalance(),
                entry.getForecastedMonthlyContribution(),
                entry.getProjectedBalance(),
                monthlyBalances
        );
    }
}
