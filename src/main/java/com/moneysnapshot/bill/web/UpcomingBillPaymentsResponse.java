package com.moneysnapshot.bill.web;

import java.time.LocalDate;
import java.util.List;

public record UpcomingBillPaymentsResponse(
        List<UpcomingBillPaymentResponse> overduePayments,
        List<UpcomingBillPaymentResponse> currentPeriodPayments
) {
    public static UpcomingBillPaymentsResponse from(List<UpcomingBillPaymentResponse> payments, LocalDate periodStart) {
        return new UpcomingBillPaymentsResponse(
                payments.stream().filter(payment -> payment.payment().dueDate().isBefore(periodStart)).toList(),
                payments.stream().filter(payment -> !payment.payment().dueDate().isBefore(periodStart)).toList()
        );
    }
}
