package com.moneysnapshot.report;

import com.moneysnapshot.report.web.PeriodComparisonResponse;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.snapshot.SnapshotType;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class PeriodComparisonQueryService {
    private final ReportPeriodComparisonCacheRepository repository;
    private final ReportCacheRefreshService refreshService;
    private final CurrentUserService currentUserService;
    private final UserSettingsService userSettingsService;
    private final AccountSnapshotRepository snapshotRepository;
    private final Clock clock;

    @Autowired
    public PeriodComparisonQueryService(ReportPeriodComparisonCacheRepository repository,
            ReportCacheRefreshService refreshService, CurrentUserService currentUserService,
            UserSettingsService userSettingsService, AccountSnapshotRepository snapshotRepository) {
        this(repository, refreshService, currentUserService, userSettingsService, snapshotRepository, Clock.systemUTC());
    }
    PeriodComparisonQueryService(ReportPeriodComparisonCacheRepository repository, ReportCacheRefreshService refreshService,
            CurrentUserService currentUserService, UserSettingsService userSettingsService,
            AccountSnapshotRepository snapshotRepository, Clock clock) {
        this.repository = repository; this.refreshService = refreshService; this.currentUserService = currentUserService;
        this.userSettingsService = userSettingsService; this.snapshotRepository = snapshotRepository; this.clock = clock;
    }
    public PeriodComparisonResponse comparison() {
        UUID ownerId = currentUserService.currentUserId();
        refreshService.ensureOwnerCacheReady(ownerId, LocalDate.now(clock));
        java.util.Set<String> finalPoints = snapshotRepository.findAllByOwnerIdWithAccountOrderBySnapshotDateAsc(ownerId).stream()
                .filter(snapshot -> snapshot.getAccount().isShowInSnapshots())
                .filter(snapshot -> snapshot.getSnapshotType() == SnapshotType.FINAL)
                .map(snapshot -> snapshot.getSnapshotDate() + "|" + snapshot.getAccount().getCurrencyCode())
                .collect(java.util.stream.Collectors.toSet());
        List<ReportPeriodComparisonCache> rows = repository.findAllByOwnerIdOrderByPeriodIndexAscPointDateAscCurrencyCodeAsc(ownerId);
        List<PeriodComparisonResponse.Period> periods = new ArrayList<>();
        for (ReportPeriodComparisonCache row : rows) {
            while (periods.size() <= row.getPeriodIndex()) periods.add(null);
            PeriodComparisonResponse.Period current = periods.get(row.getPeriodIndex());
            List<PeriodComparisonResponse.Point> points = current == null ? new ArrayList<>() : new ArrayList<>(current.points());
            boolean finalSnapshot = finalPoints.contains(row.getPointDate() + "|" + row.getCurrencyCode());
            points.add(new PeriodComparisonResponse.Point(row.getPointDate(), row.getCurrencyCode(), row.getAmount(), finalSnapshot));
            periods.set(row.getPeriodIndex(), new PeriodComparisonResponse.Period(row.getPeriodIndex(), row.getPeriodStartDate(), row.getPeriodEndDate(), points));
        }
        return new PeriodComparisonResponse(periods.stream().filter(java.util.Objects::nonNull).toList());
    }
}
