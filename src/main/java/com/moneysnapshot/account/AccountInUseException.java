package com.moneysnapshot.account;

import java.util.UUID;

public class AccountInUseException extends RuntimeException {

    public AccountInUseException(UUID id) {
        super("Account is linked to existing bills and cannot be deleted: " + id);
    }
}
