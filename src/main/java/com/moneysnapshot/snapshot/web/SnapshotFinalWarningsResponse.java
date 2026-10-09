package com.moneysnapshot.snapshot.web;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SnapshotFinalWarningsResponse(
        List<PeriodWarning> missingFinalPeriods,
        List<PeriodWarning> multipleFinalPeriods
) {
    public record RegisteredFinals(LocalDate periodStartDate, LocalDate periodEndDate, List<RegisteredAccount> accounts) {
    }

    public record RegisteredAccount(UUID accountId, String accountName, long finalSnapshots) {
    }

    public record PeriodWarning(
            LocalDate periodStartDate,
            LocalDate periodEndDate,
            List<AccountWarning> accounts
    ) {
    }

    public record AccountWarning(
            String accountName,
            long finalSnapshots
    ) {
    }
}
