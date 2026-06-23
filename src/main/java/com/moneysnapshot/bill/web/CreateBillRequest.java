package com.moneysnapshot.bill.web;

import com.moneysnapshot.bill.BillDurationType;
import com.moneysnapshot.bill.BillStatus;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CreateBillRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull @Digits(integer = 17, fraction = 4) BigDecimal amount,
        @NotNull BillDurationType durationType,
        LocalDate endDate,
        Integer installmentCount,
        @NotNull Integer repaymentDay,
        @NotNull LocalDate startFrom,
        @NotNull UUID counterpartyId,
        @NotNull UUID accountId,
        @NotNull BillStatus status
) {
}
