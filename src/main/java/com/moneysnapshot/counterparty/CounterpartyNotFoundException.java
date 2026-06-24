package com.moneysnapshot.counterparty;

import java.util.UUID;

public class CounterpartyNotFoundException extends RuntimeException {

    public CounterpartyNotFoundException(UUID id) {
        super("Counterparty not found: " + id);
    }
}
