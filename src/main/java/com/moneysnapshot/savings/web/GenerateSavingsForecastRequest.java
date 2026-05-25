package com.moneysnapshot.savings.web;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record GenerateSavingsForecastRequest(
        @NotNull
        LocalDate forecastStartDate,

        @NotNull
        Integer durationMonths
) {
}
