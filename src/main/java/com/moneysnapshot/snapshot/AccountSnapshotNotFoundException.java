package com.moneysnapshot.snapshot;

import java.util.UUID;

public class AccountSnapshotNotFoundException extends RuntimeException {

    public AccountSnapshotNotFoundException(UUID id) {
        super("Account snapshot not found: " + id);
    }
}
