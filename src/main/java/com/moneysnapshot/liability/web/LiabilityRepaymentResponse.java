package com.moneysnapshot.liability.web;

import com.moneysnapshot.liability.LiabilityRepayment;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record LiabilityRepaymentResponse(
        UUID id,
        UUID liabilityId,
        String liabilityName,
        String bankName,
        LocalDate repaymentDate,
        BigDecimal currentAmount,
        BigDecimal amount,
        String note,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static LiabilityRepaymentResponse from(LiabilityRepayment repayment) {
        return new LiabilityRepaymentResponse(
                repayment.getId(),
                repayment.getLiability().getId(),
                repayment.getLiability().getName(),
                repayment.getLiability().getBank().getName(),
                repayment.getRepaymentDate(),
                repayment.getCurrentAmount(),
                repayment.getAmount(),
                repayment.getNote(),
                repayment.getCreatedAt(),
                repayment.getUpdatedAt()
        );
    }
}
