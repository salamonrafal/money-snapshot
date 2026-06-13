package com.moneysnapshot.liability.web;

import com.moneysnapshot.liability.LiabilityScheduleMode;
import com.moneysnapshot.liability.LiabilityStatus;
import com.moneysnapshot.liability.LiabilityTypeCode;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateLiabilityRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 120) String bankName,
        @NotNull LiabilityTypeCode liabilityTypeCode,
        LiabilityScheduleMode scheduleMode,
        @Digits(integer = 17, fraction = 4) BigDecimal currentAmount,
        @Digits(integer = 17, fraction = 4) BigDecimal installmentAmount,
        @Digits(integer = 17, fraction = 4) BigDecimal creditCardLimit,
        @Digits(integer = 17, fraction = 4) BigDecimal creditCardMinimumPayment,
        LocalDate repaymentStartDate,
        LocalDate endDate,
        Integer installmentCount,
        Integer firstRepaymentDay,
        @Size(max = 500) String note,
        @NotNull LiabilityStatus status
) {
}
