package com.moneysnapshot.transactionanalyzer.web;

import com.moneysnapshot.transactionanalyzer.TransactionFileStorageService.StoredTransactionFile;

public record TransactionFileResponse(String id, String originalFilename, String downloadUrl) {

    public static TransactionFileResponse from(StoredTransactionFile file) {
        return new TransactionFileResponse(file.id(), file.originalFilename(), "/api/transaction-analyzer/uploads/" + file.id());
    }
}
