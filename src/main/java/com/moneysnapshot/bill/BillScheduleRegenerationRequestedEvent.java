package com.moneysnapshot.bill;

import java.util.UUID;

public record BillScheduleRegenerationRequestedEvent(
        UUID billId,
        boolean regenerateFromCurrentDate
) {
}
