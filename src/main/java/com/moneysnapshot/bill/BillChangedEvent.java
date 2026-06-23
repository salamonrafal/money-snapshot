package com.moneysnapshot.bill;

import java.util.UUID;

public record BillChangedEvent(
        UUID billId,
        UUID ownerId,
        boolean regenerateSchedule,
        boolean regenerateFromCurrentDate
) {
}
