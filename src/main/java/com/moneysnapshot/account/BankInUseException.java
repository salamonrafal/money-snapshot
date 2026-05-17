package com.moneysnapshot.account;

import java.util.UUID;

public class BankInUseException extends RuntimeException {

    public BankInUseException(UUID id) {
        super("Bank is used by existing accounts: " + id);
    }
}
