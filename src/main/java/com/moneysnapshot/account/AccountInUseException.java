package com.moneysnapshot.account;

import java.util.UUID;

public class AccountInUseException extends RuntimeException {

    public AccountInUseException(UUID id) {
        super("Account is in use: " + id);
    }
}
