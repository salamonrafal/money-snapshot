package com.moneysnapshot.savings.web;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record SavingsForecastRunResponse(
        UUID runId,
        LocalDate forecastStartDate,
        LocalDate forecastEndDate,
        int durationMonths,
        OffsetDateTime generatedAt,
        List<LocalDate> forecastMonths,
        List<SavingsForecastSummaryResponse> summaries,
        List<SavingsForecastEntryResponse> entries
) {
}
