package com.moneysnapshot.liability.web;

import com.moneysnapshot.liability.LiabilityRepaymentSourceType;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record RegisterLiabilityRepaymentRequest(
        @NotNull LocalDate repaymentDate,
        @NotNull LiabilityRepaymentSourceType sourceType,
        @NotNull @Digits(integer = 17, fraction = 4) BigDecimal sourceAmount,
        @Size(max = 500) String note
) {
}
