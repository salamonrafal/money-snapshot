package com.moneysnapshot.retirement;

public class DuplicateRetirementAccountNameException extends RuntimeException {

    public DuplicateRetirementAccountNameException(String normalizedName) {
        super("Retirement account with normalized name already exists: " + normalizedName);
    }
}
