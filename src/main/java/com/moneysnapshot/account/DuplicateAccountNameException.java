package com.moneysnapshot.account;

public class DuplicateAccountNameException extends RuntimeException {

    public DuplicateAccountNameException(String normalizedName) {
        super("Account with normalized name already exists: " + normalizedName);
    }
}
