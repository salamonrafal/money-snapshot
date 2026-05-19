package com.moneysnapshot.snapshot.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record BulkCreateAccountSnapshotsRequest(
        @NotEmpty
        List<@Valid CreateAccountSnapshotRequest> snapshots
) {
}
