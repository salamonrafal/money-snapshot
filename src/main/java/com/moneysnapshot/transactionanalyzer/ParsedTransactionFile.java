package com.moneysnapshot.transactionanalyzer;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record ParsedTransactionFile(
        String dateRange,
        String accountNumber,
        String accountName,
        List<Transaction> transactions
) {
    public record Transaction(LocalDate transactionDate, String title, String counterparty, BigDecimal amount, String currency) {
    }
}
