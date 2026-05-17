package com.moneysnapshot.snapshot.web;

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

        @Size(max = 500)
        String note
) {
}
