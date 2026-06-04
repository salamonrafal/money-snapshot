package com.moneysnapshot.report.web;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.report.ReportCacheMaintenanceService;
import com.moneysnapshot.report.ReportQueryService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ReportControllerTest {

    private final ReportQueryService reportQueryService = mock(ReportQueryService.class);
    private final ReportCacheMaintenanceService reportCacheMaintenanceService = mock(ReportCacheMaintenanceService.class);
    private final ReportController controller = new ReportController(reportQueryService, reportCacheMaintenanceService);

    @Test
    void historyRejectsReversedDateRange() {
        assertThatThrownBy(() -> controller.history(
                LocalDate.of(2026, 6, 10),
                LocalDate.of(2026, 6, 9),
                0,
                20
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("fromDate must be on or before toDate.")
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void historyRejectsRangeLongerThanConfiguredLimit() {
        assertThatThrownBy(() -> controller.history(
                LocalDate.of(2024, 1, 1),
                LocalDate.of(2026, 1, 2),
                0,
                20
        ))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("History range cannot exceed 732 days.")
                .extracting(error -> ((ResponseStatusException) error).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void historyDelegatesForValidRange() {
        HistoryReportResponse response = new HistoryReportResponse(List.of(), List.of(), 0, 20, 0, 1, true, true);
        LocalDate fromDate = LocalDate.of(2026, 1, 1);
        LocalDate toDate = LocalDate.of(2026, 12, 31);

        when(reportQueryService.history(fromDate, toDate, 0, 100)).thenReturn(response);

        controller.history(fromDate, toDate, 0, 200);

        verify(reportQueryService).history(fromDate, toDate, 0, 100);
    }
}
