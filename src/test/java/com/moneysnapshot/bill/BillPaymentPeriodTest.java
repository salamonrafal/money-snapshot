package com.moneysnapshot.bill;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BillPaymentPeriodTest {
    @ParameterizedTest
    @CsvSource({
            "2026-09-06, 10, 2026-08-11, 2026-09-10",
            "2026-09-10, 10, 2026-08-11, 2026-09-10",
            "2026-09-11, 10, 2026-09-11, 2026-10-10",
            "2026-02-28, 31, 2026-02-01, 2026-02-28",
            "2026-03-01, 31, 2026-03-01, 2026-03-31",
            "2024-02-29, 30, 2024-01-31, 2024-02-29",
            "2026-01-01, 10, 2025-12-11, 2026-01-10",
            "2026-09-01, 1, 2026-08-02, 2026-09-01"
    })
    void resolvesInclusivePeriodUsingConfiguredEndDay(String today, int endDay, String start, String end) {
        assertThat(BillPaymentPeriod.current(LocalDate.parse(today), endDay))
                .isEqualTo(new BillPaymentPeriod(LocalDate.parse(start), LocalDate.parse(end)));
    }
}
