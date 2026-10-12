package com.moneysnapshot.transactionanalyzer;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransactionFileAnalysisService {

    private final Map<TransactionBank, TransactionFileAnalyzer> analyzers;

    public TransactionFileAnalysisService(List<TransactionFileAnalyzer> analyzers) {
        this.analyzers = analyzers.stream().collect(Collectors.toUnmodifiableMap(TransactionFileAnalyzer::bank, analyzer -> analyzer));
    }

    public RecurringTransactionAnalysis analyze(TransactionBank bank, MultipartFile file) {
        TransactionFileAnalyzer analyzer = analyzers.get(bank);
        if (analyzer == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported bank.");
        }
        try (var inputStream = file.getInputStream()) {
            ParsedTransactionFile parsedFile = analyzer.analyze(inputStream);
            return new RecurringTransactionAnalysis(parsedFile.dateRange(), parsedFile.accountNumber(), parsedFile.accountName(),
                    recurringTransactions(parsedFile.transactions()));
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read transaction file.", exception);
        }
    }

    private List<RecurringTransactionAnalysis.RecurringTransaction> recurringTransactions(List<ParsedTransactionFile.Transaction> transactions) {
        return transactions.stream()
                .filter(transaction -> transaction.amount().signum() < 0)
                .collect(Collectors.groupingBy(transaction -> new RecurrenceKey(
                        normalizedTitle(transaction.title()), transaction.counterparty(), normalizedAmount(transaction.amount()), transaction.currency()
                )))
                .values().stream()
                .filter(group -> group.size() > 1)
                .map(this::recurringTransaction)
                .sorted(Comparator.comparingInt((RecurringTransactionAnalysis.RecurringTransaction transaction) ->
                                transaction.transactionDates().size())
                        .reversed()
                        .thenComparing(RecurringTransactionAnalysis.RecurringTransaction::counterparty)
                        .thenComparing(RecurringTransactionAnalysis.RecurringTransaction::amount))
                .toList();
    }

    private RecurringTransactionAnalysis.RecurringTransaction recurringTransaction(List<ParsedTransactionFile.Transaction> transactions) {
        List<ParsedTransactionFile.Transaction> orderedTransactions = transactions.stream()
                .sorted(Comparator.comparing(ParsedTransactionFile.Transaction::transactionDate))
                .toList();
        ParsedTransactionFile.Transaction first = orderedTransactions.get(0);
        return new RecurringTransactionAnalysis.RecurringTransaction(
                orderedTransactions.stream().map(ParsedTransactionFile.Transaction::transactionDate).toList(),
                first.title(), first.counterparty(), first.amount(), first.currency()
        );
    }

    private String normalizedTitle(String title) {
        return title.replaceAll("\\b\\d{2}\\.\\d{2}\\.\\d{4}\\b", "")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(java.util.Locale.ROOT);
    }

    private BigDecimal normalizedAmount(BigDecimal amount) {
        return amount.stripTrailingZeros();
    }

    private record RecurrenceKey(String title, String counterparty, BigDecimal amount, String currency) {
    }
}
