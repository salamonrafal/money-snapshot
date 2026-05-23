package com.moneysnapshot.snapshot.web;

import com.moneysnapshot.snapshot.SnapshotType;
import jakarta.validation.constraints.NotNull;

public record UpdateSnapshotTypeRequest(
        @NotNull
        SnapshotType snapshotType
) {
}
