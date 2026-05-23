package com.moneysnapshot.snapshot.web;

import com.moneysnapshot.snapshot.SnapshotType;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CreateAccountSnapshotRequest(
        @NotNull
        UUID accountId,

        @NotNull
        LocalDate snapshotDate,

        @NotNull
        @Digits(integer = 15, fraction = 4)
        BigDecimal balance,

        @NotNull
        SnapshotType snapshotType,

        @Size(max = 500)
        String note
) {
}
