package com.moneysnapshot.snapshot;

import java.time.LocalDate;
import java.util.UUID;

public class DuplicateAccountSnapshotException extends RuntimeException {

    public DuplicateAccountSnapshotException(UUID accountId, LocalDate snapshotDate) {
        super("Snapshot already exists for account " + accountId + " and date " + snapshotDate);
    }
}
