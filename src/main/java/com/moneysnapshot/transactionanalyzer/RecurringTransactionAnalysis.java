package com.moneysnapshot.transactionanalyzer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RecurringTransactionAnalysis(
        String dateRange,
        String accountNumber,
        String accountName,
        List<RecurringTransaction> recurringTransactions
) {
    public record RecurringTransaction(
            List<LocalDate> transactionDates, String title, String counterparty, BigDecimal amount, String currency
    ) {
    }
}
