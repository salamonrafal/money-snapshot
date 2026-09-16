package com.moneysnapshot.retirement;

import java.util.UUID;

public class RetirementAccountNotFoundException extends RuntimeException {

    public RetirementAccountNotFoundException(UUID id) {
        super("Retirement account not found: " + id);
    }
}
