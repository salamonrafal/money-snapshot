package com.moneysnapshot.counterparty;

public class DuplicateCounterpartyNameException extends RuntimeException {

    public DuplicateCounterpartyNameException(String normalizedName) {
        super("Counterparty with normalized name already exists: " + normalizedName);
    }
}
