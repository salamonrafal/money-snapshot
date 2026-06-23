package com.moneysnapshot.bill.web;

import com.moneysnapshot.bill.Bill;
import com.moneysnapshot.bill.BillDurationType;
import com.moneysnapshot.bill.BillStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BillScheduleSummaryResponse(
        UUID id,
        String name,
        BigDecimal amount,
        String currencyCode,
        Integer repaymentDay,
        LocalDate startFrom,
        BillDurationType durationType,
        LocalDate endDate,
        Integer installmentCount,
        String counterpartyName,
        String accountName,
        BillStatus status
) {

    public static BillScheduleSummaryResponse from(Bill bill) {
        return new BillScheduleSummaryResponse(
                bill.getId(),
                bill.getName(),
                bill.getAmount(),
                bill.getCurrencyCode(),
                bill.getRepaymentDay(),
                bill.getStartFrom(),
                bill.getDurationType(),
                bill.getEndDate(),
                bill.getInstallmentCount(),
                bill.getCounterparty().getName(),
                bill.getAccount().getName(),
                bill.getStatus()
        );
    }
}
