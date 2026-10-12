package com.moneysnapshot.transactionanalyzer;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PushbackReader;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class IngTransactionFileAnalyzer implements TransactionFileAnalyzer {

    private static final Charset ING_CSV_CHARSET = Charset.forName("windows-1250");
    private static final int HEADER_ROW = 18;
    private static final int DATE_RANGE_ROW = 12;
    private static final int ACCOUNT_ROW = 8;

    @Override
    public TransactionBank bank() {
        return TransactionBank.ING;
    }

    @Override
    public ParsedTransactionFile analyze(InputStream inputStream) {
        try (PushbackReader reader = new PushbackReader(new BufferedReader(new InputStreamReader(inputStream, ING_CSV_CHARSET)), 1)) {
            List<List<String>> rows = parseCsvRecords(reader);
            validateLayout(rows);
            List<String> accountRow = rows.get(ACCOUNT_ROW);
            List<ParsedTransactionFile.Transaction> transactions = rows.stream()
                    .skip(HEADER_ROW + 1L)
                    .filter(row -> isTransactionRow(value(row, 0)))
                    .map(this::transaction)
                    .toList();
            return new ParsedTransactionFile(value(rows.get(DATE_RANGE_ROW), 1), normalizeAccountNumber(value(accountRow, 2)),
                    value(accountRow, 0), transactions);
        } catch (IOException | IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ING transaction file.", exception);
        }
    }

    private void validateLayout(List<List<String>> rows) {
        if (rows.size() <= HEADER_ROW || !"Data transakcji".equals(value(rows.get(HEADER_ROW), 0))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ING transaction file.");
        }
    }

    private boolean isTransactionRow(String value) {
        try {
            LocalDate.parse(value);
            return true;
        } catch (java.time.format.DateTimeParseException exception) {
            return false;
        }
    }

    private ParsedTransactionFile.Transaction transaction(List<String> row) {
        return new ParsedTransactionFile.Transaction(LocalDate.parse(value(row, 0)), value(row, 3), value(row, 2),
                new BigDecimal(value(row, 8).replace(",", ".")), value(row, 9));
    }

    private List<List<String>> parseCsvRecords(PushbackReader reader) throws IOException {
        List<List<String>> rows = new ArrayList<>();
        List<String> columns = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean quoted = false;
        int nextCharacter;
        while ((nextCharacter = reader.read()) != -1) {
            char character = (char) nextCharacter;
            if (character == '"') {
                if (quoted) {
                    int escapedQuote = reader.read();
                    if (escapedQuote == '"') {
                        value.append(character);
                    } else {
                        quoted = false;
                        if (escapedQuote != -1) {
                            reader.unread(escapedQuote);
                        }
                    }
                } else {
                    quoted = !quoted;
                }
            } else if (character == ';' && !quoted) {
                columns.add(value.toString().trim());
                value.setLength(0);
            } else if ((character == '\n' || character == '\r') && !quoted) {
                if (character == '\r') {
                    int lineFeed = reader.read();
                    if (lineFeed != '\n' && lineFeed != -1) {
                        reader.unread(lineFeed);
                    }
                }
                columns.add(value.toString().trim());
                rows.add(columns);
                columns = new ArrayList<>();
                value.setLength(0);
            } else {
                value.append(character);
            }
        }
        if (quoted) {
            throw new IllegalArgumentException("Unclosed quoted CSV value");
        }
        if (!columns.isEmpty() || value.length() > 0) {
            columns.add(value.toString().trim());
            rows.add(columns);
        }
        return rows;
    }

    private String value(List<String> row, int index) {
        return index < row.size() ? row.get(index).trim() : "";
    }

    private String normalizeAccountNumber(String accountNumber) {
        return accountNumber.replace("'", "").trim();
    }
}
