package com.moneysnapshot.transactionanalyzer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class TransactionFileAnalysisServiceTest {

    @Test
    void findsRecurringTransactionsAndIngDocumentDetails() throws Exception {
        TransactionFileAnalysisService service = new TransactionFileAnalysisService(List.of(new IngTransactionFileAnalyzer()));
        InputStream fixture = getClass().getResourceAsStream("/transactionanalyzer/ing-transactions.csv");
        assertNotNull(fixture);

        RecurringTransactionAnalysis analysis = service.analyze(TransactionBank.ING,
                new MockMultipartFile("file", "transactions.csv", "text/csv", fixture));

        assertEquals("2026-07-01 - 2026-10-31", analysis.dateRange());
        assertEquals("69 1050 1025 1000 0098 2767 9656", analysis.accountNumber());
        assertEquals("Virtual ING card (PLN)", analysis.accountName());
        RecurringTransactionAnalysis.RecurringTransaction openAi = analysis.recurringTransactions().stream()
                .filter(transaction -> transaction.counterparty().startsWith("OPENAI *CHATGPT"))
                .findFirst().orElseThrow();
        assertEquals(List.of("2026-08-07", "2026-09-07", "2026-10-07"),
                openAi.transactionDates().stream().map(Object::toString).toList());
        assertEquals("-99.00", openAi.amount().toPlainString());
        assertEquals("PLN", openAi.currency());
        assertTrue(analysis.recurringTransactions().stream()
                .allMatch(transaction -> transaction.amount().signum() < 0));
    }
}
