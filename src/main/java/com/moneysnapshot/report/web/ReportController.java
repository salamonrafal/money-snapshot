package com.moneysnapshot.report.web;

import com.moneysnapshot.report.ReportCacheMaintenanceService;
import com.moneysnapshot.report.ReportQueryService;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private static final long MAX_HISTORY_RANGE_DAYS = 732L;

    private final ReportQueryService reportQueryService;
    private final ReportCacheMaintenanceService reportCacheMaintenanceService;

    public ReportController(
            ReportQueryService reportQueryService,
            ReportCacheMaintenanceService reportCacheMaintenanceService
    ) {
        this.reportQueryService = reportQueryService;
        this.reportCacheMaintenanceService = reportCacheMaintenanceService;
    }

    @GetMapping("/summary")
    public SummaryReportResponse summary(
            @RequestParam(defaultValue = "accounts") String scope,
            @RequestParam LocalDate fromDate,
            @RequestParam LocalDate toDate
    ) {
        return reportQueryService.summary(scope, fromDate, toDate);
    }

    @GetMapping("/overview")
    public OverviewReportResponse overview(
            @RequestParam(defaultValue = "accounts") String scope,
            @RequestParam LocalDate toDate
    ) {
        return reportQueryService.overview(scope, toDate);
    }

    @GetMapping("/average-contributions")
    public AverageContributionReportResponse averageContributions() {
        return reportQueryService.averageContributions();
    }

    @GetMapping("/planning")
    public PlanningReportResponse planning() {
        return reportQueryService.planning();
    }

    @GetMapping("/history")
    public HistoryReportResponse history(
            @RequestParam LocalDate fromDate,
            @RequestParam LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        validateHistoryRange(fromDate, toDate);
        return reportQueryService.history(fromDate, toDate, page, Math.max(1, Math.min(size, 100)));
    }

    @PostMapping("/cache/clear")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearCache() {
        reportCacheMaintenanceService.clearCurrentUserCache();
    }

    private void validateHistoryRange(LocalDate fromDate, LocalDate toDate) {
        if (toDate.isBefore(fromDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fromDate must be on or before toDate.");
        }

        long rangeDays = ChronoUnit.DAYS.between(fromDate, toDate) + 1L;
        if (rangeDays > MAX_HISTORY_RANGE_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "History range cannot exceed 732 days.");
        }
    }
}
