package com.moneysnapshot.account;

import java.util.UUID;

public class BankNotFoundException extends RuntimeException {

    public BankNotFoundException(UUID id) {
        super("Bank not found: " + id);
    }
}
