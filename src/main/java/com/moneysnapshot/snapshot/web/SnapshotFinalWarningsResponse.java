package com.moneysnapshot.snapshot.web;

import java.time.LocalDate;
import java.util.List;

public record SnapshotFinalWarningsResponse(
        List<PeriodWarning> missingFinalPeriods,
        List<PeriodWarning> multipleFinalPeriods
) {
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
