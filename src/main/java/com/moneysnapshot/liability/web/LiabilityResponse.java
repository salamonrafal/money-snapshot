package com.moneysnapshot.liability.web;

import com.moneysnapshot.liability.Liability;
import com.moneysnapshot.liability.LiabilityScheduleMode;
import com.moneysnapshot.liability.LiabilityStatus;
import com.moneysnapshot.liability.LiabilityTypeCode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record LiabilityResponse(
        UUID id,
        UUID bankId,
        String bankName,
        String name,
        String normalizedName,
        LiabilityTypeCode liabilityTypeCode,
        String currencyCode,
        BigDecimal originalAmount,
        BigDecimal currentAmount,
        BigDecimal paidAmount,
        BigDecimal installmentAmount,
        BigDecimal creditCardLimit,
        BigDecimal creditCardMinimumPayment,
        LocalDate repaymentStartDate,
        LocalDate endDate,
        Integer installmentCount,
        Integer firstRepaymentDay,
        LiabilityScheduleMode scheduleMode,
        String note,
        LiabilityStatus status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<LiabilityRepaymentResponse> repayments
) {
    public static LiabilityResponse from(Liability liability, List<LiabilityRepaymentResponse> repayments) {
        BigDecimal paidAmount = resolvePaidAmount(liability, repayments);
        return new LiabilityResponse(
                liability.getId(),
                liability.getBank().getId(),
                liability.getBank().getName(),
                liability.getName(),
                liability.getNormalizedName(),
                liability.getLiabilityTypeCode(),
                liability.getCurrencyCode(),
                liability.getOriginalAmount(),
                liability.getCurrentAmount(),
                paidAmount,
                liability.getInstallmentAmount(),
                liability.getCreditCardLimit(),
                liability.getCreditCardMinimumPayment(),
                liability.getRepaymentStartDate(),
                liability.getEndDate(),
                liability.getInstallmentCount(),
                liability.getFirstRepaymentDay(),
                liability.getScheduleMode(),
                liability.getNote(),
                liability.getStatus(),
                liability.getCreatedAt(),
                liability.getUpdatedAt(),
                repayments
        );
    }

    private static BigDecimal resolvePaidAmount(Liability liability, List<LiabilityRepaymentResponse> repayments) {
        if (liability.getLiabilityTypeCode() == LiabilityTypeCode.CREDIT_CARD) {
            return repayments.stream()
                    .map(LiabilityRepaymentResponse::amount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        return liability.getOriginalAmount().subtract(liability.getCurrentAmount());
    }
}
