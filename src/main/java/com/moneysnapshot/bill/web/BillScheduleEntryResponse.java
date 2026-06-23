package com.moneysnapshot.bill.web;

import com.moneysnapshot.bill.BillScheduleEntry;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BillScheduleEntryResponse(
        UUID id,
        Integer installmentNumber,
        LocalDate dueDate,
        BigDecimal amount,
        String currencyCode,
        boolean paid,
        OffsetDateTime paidAt
) {

    public static BillScheduleEntryResponse from(BillScheduleEntry entry) {
        return new BillScheduleEntryResponse(
                entry.getId(),
                entry.getInstallmentNumber(),
                entry.getDueDate(),
                entry.getAmount(),
                entry.getCurrencyCode(),
                entry.isPaid(),
                entry.getPaidAt()
        );
    }
}
