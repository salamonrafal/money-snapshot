package com.moneysnapshot.snapshot;

import java.time.LocalDate;
import java.util.UUID;

public record AccountSnapshotCreatedEvent(
        UUID ownerId,
        UUID snapshotId,
        UUID accountId,
        LocalDate snapshotDate
) {
}
