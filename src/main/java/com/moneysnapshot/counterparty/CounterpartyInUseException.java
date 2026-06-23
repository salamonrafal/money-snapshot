package com.moneysnapshot.counterparty;

import java.util.UUID;

public class CounterpartyInUseException extends RuntimeException {

    public CounterpartyInUseException(UUID id) {
        super("Counterparty is used by existing bills and cannot be deleted: " + id);
    }
}
