package com.moneysnapshot.calendar.web;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CalendarEventResponse(
        String id,
        String type,
        LocalDate date,
        String title,
        String description,
        BigDecimal amount,
        String currencyCode,
        String snapshotLabel
) {
}
