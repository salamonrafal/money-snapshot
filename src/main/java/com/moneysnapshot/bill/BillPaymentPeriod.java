package com.moneysnapshot.bill;

import java.time.LocalDate;
import java.time.YearMonth;

public record BillPaymentPeriod(LocalDate start, LocalDate end) {
    public static BillPaymentPeriod current(LocalDate today, int endDay) {
        int day = Math.max(1, Math.min(31, endDay));
        YearMonth month = YearMonth.from(today);
        LocalDate end = month.atDay(Math.min(day, month.lengthOfMonth()));
        if (today.isAfter(end)) {
            month = month.plusMonths(1);
            end = month.atDay(Math.min(day, month.lengthOfMonth()));
        }
        YearMonth previous = month.minusMonths(1);
        LocalDate start = previous.atDay(Math.min(day, previous.lengthOfMonth())).plusDays(1);
        return new BillPaymentPeriod(start, end);
    }
}
