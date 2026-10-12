package com.moneysnapshot.transactionanalyzer;

import java.io.InputStream;

public interface TransactionFileAnalyzer {

    TransactionBank bank();

    ParsedTransactionFile analyze(InputStream inputStream);
}
