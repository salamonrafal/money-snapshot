package com.moneysnapshot.bill;

import java.util.UUID;
import java.time.LocalDate;

public record BillScheduleRegenerationRequestedEvent(
        UUID billId,
        boolean regenerateFromCurrentDate,
        LocalDate effectiveFrom
) {
    public BillScheduleRegenerationRequestedEvent(UUID billId, boolean regenerateFromCurrentDate) {
        this(billId, regenerateFromCurrentDate, null);
    }
}
