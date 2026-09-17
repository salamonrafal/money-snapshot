package com.moneysnapshot.report.web;

import com.moneysnapshot.report.ReportCacheMaintenanceService;
import com.moneysnapshot.report.ReportQueryService;
import com.moneysnapshot.report.BillingPeriodComparisonQueryService;
import com.moneysnapshot.report.PeriodComparisonQueryService;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final BillingPeriodComparisonQueryService billingPeriodComparisonQueryService;
    private final PeriodComparisonQueryService periodComparisonQueryService;

    @Autowired
    public ReportController(
            ReportQueryService reportQueryService,
            ReportCacheMaintenanceService reportCacheMaintenanceService,
            BillingPeriodComparisonQueryService billingPeriodComparisonQueryService,
            PeriodComparisonQueryService periodComparisonQueryService
    ) {
        this.reportQueryService = reportQueryService;
        this.reportCacheMaintenanceService = reportCacheMaintenanceService;
        this.billingPeriodComparisonQueryService = billingPeriodComparisonQueryService;
        this.periodComparisonQueryService = periodComparisonQueryService;
    }

    public ReportController(
            ReportQueryService reportQueryService,
            ReportCacheMaintenanceService reportCacheMaintenanceService,
            BillingPeriodComparisonQueryService billingPeriodComparisonQueryService
    ) {
        this(reportQueryService, reportCacheMaintenanceService, billingPeriodComparisonQueryService, null);
    }

    @GetMapping("/summary")
    public SummaryReportResponse summary(
            @RequestParam(defaultValue = "accounts") String scope,
            @RequestParam LocalDate fromDate,
            @RequestParam LocalDate toDate,
            @RequestParam(required = false) LocalDate baselineDate
    ) {
        return reportQueryService.summary(scope, fromDate, toDate, baselineDate);
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

    @GetMapping("/retirement-capital")
    public RetirementCapitalReportResponse retirementCapital(
            @RequestParam(defaultValue = "type") String grouping
    ) {
        return reportQueryService.retirementCapital(grouping);
    }

    @GetMapping("/planning")
    public PlanningReportResponse planning() {
        return reportQueryService.planning();
    }

    @GetMapping("/billing-period-comparison")
    public BillingPeriodComparisonResponse billingPeriodComparison(
            @RequestParam(defaultValue = "3") int periods
    ) {
        return billingPeriodComparisonQueryService.comparison(periods);
    }

    @GetMapping("/period-comparison")
    public PeriodComparisonResponse periodComparison() {
        return periodComparisonQueryService.comparison();
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

    @PostMapping("/period-comparison/cache/rebuild")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rebuildPeriodComparisonCache() {
        reportCacheMaintenanceService.rebuildCurrentUserPeriodComparisonCache();
    }

    private void validateHistoryRange(LocalDate fromDate, LocalDate toDate) {
        if (toDate.isBefore(fromDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "fromDate must be on or before toDate.");
        }

        long rangeDays = ChronoUnit.DAYS.between(fromDate, toDate) + 1L;
        if (rangeDays > MAX_HISTORY_RANGE_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "History range cannot exceed " + MAX_HISTORY_RANGE_DAYS + " days.");
        }
    }
}
