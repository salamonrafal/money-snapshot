package com.moneysnapshot.bill.web;

import com.moneysnapshot.bill.BillScheduleEntry;
import java.util.UUID;

public record UpcomingBillPaymentResponse(
        UUID billId,
        String billName,
        String counterpartyName,
        String accountName,
        BillScheduleEntryResponse payment
) {
    public static UpcomingBillPaymentResponse from(BillScheduleEntry entry) {
        var bill = entry.getBill();
        return new UpcomingBillPaymentResponse(bill.getId(), bill.getName(),
                bill.getCounterparty().getName(), bill.getAccount().getName(),
                BillScheduleEntryResponse.from(entry));
    }
}
