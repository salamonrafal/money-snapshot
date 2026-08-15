package com.moneysnapshot.report;

import com.moneysnapshot.report.web.BillingPeriodComparisonResponse;
import com.moneysnapshot.security.CurrentUserService;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class BillingPeriodComparisonQueryService {

    private final ReportBillingPeriodComparisonCacheRepository repository;
    private final ReportCacheRefreshService refreshService;
    private final CurrentUserService currentUserService;
    private final Clock clock;

    @Autowired
    public BillingPeriodComparisonQueryService(
            ReportBillingPeriodComparisonCacheRepository repository,
            ReportCacheRefreshService refreshService,
            CurrentUserService currentUserService
    ) {
        this(repository, refreshService, currentUserService, Clock.systemUTC());
    }

    BillingPeriodComparisonQueryService(
            ReportBillingPeriodComparisonCacheRepository repository,
            ReportCacheRefreshService refreshService,
            CurrentUserService currentUserService,
            Clock clock
    ) {
        this.repository = repository;
        this.refreshService = refreshService;
        this.currentUserService = currentUserService;
        this.clock = clock;
    }

    public BillingPeriodComparisonResponse comparison(int periods) {
        int safePeriods = Math.max(1, Math.min(periods, 6));
        UUID ownerId = currentUserService.currentUserId();
        refreshService.ensureOwnerCacheReady(ownerId, LocalDate.now(clock));
        return new BillingPeriodComparisonResponse(repository
                .findAllByOwnerIdAndPeriodIndexLessThanEqualOrderByPeriodIndexAscCurrencyCodeAsc(ownerId, safePeriods)
                .stream()
                .map(row -> new BillingPeriodComparisonResponse.Row(
                        row.getPeriodIndex(), row.getPeriodStartDate(), row.getPeriodEndDate(),
                        row.getReferenceStartDate(), row.getReferenceEndDate(), row.getCurrencyCode(),
                        row.getPeriodChange(), row.getReferenceChange(), row.getDifference(), row.getDifferencePercent()
                ))
                .toList());
    }
}
