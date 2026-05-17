package com.moneysnapshot.account;

public class DuplicateBankNameException extends RuntimeException {

    public DuplicateBankNameException(String normalizedName) {
        super("Bank with normalized name already exists: " + normalizedName);
    }
}
