package com.moneysnapshot.bill.web;

import com.moneysnapshot.bill.Bill;
import com.moneysnapshot.bill.BillDurationType;
import com.moneysnapshot.bill.BillStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BillResponse(
        UUID id,
        String name,
        String normalizedName,
        BigDecimal amount,
        String currencyCode,
        BillDurationType durationType,
        LocalDate endDate,
        Integer installmentCount,
        Integer repaymentDay,
        LocalDate startFrom,
        UUID counterpartyId,
        String counterpartyName,
        UUID accountId,
        String accountName,
        BillStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {

    public static BillResponse from(Bill bill) {
        return new BillResponse(
                bill.getId(),
                bill.getName(),
                bill.getNormalizedName(),
                bill.getAmount(),
                bill.getCurrencyCode(),
                bill.getDurationType(),
                bill.getEndDate(),
                bill.getInstallmentCount(),
                bill.getRepaymentDay(),
                bill.getStartFrom(),
                bill.getCounterparty().getId(),
                bill.getCounterparty().getName(),
                bill.getAccount().getId(),
                bill.getAccount().getName(),
                bill.getStatus(),
                bill.getCreatedAt(),
                bill.getUpdatedAt()
        );
    }
}
