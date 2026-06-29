package com.moneysnapshot.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.dashboard.SnapshotPanelResponse;
import com.moneysnapshot.dashboard.SnapshotPanelChartPointResponse;
import com.moneysnapshot.report.web.OverviewReportResponse;
import com.moneysnapshot.report.web.HistoryReportResponse;
import com.moneysnapshot.report.web.PlanningReportResponse;
import com.moneysnapshot.report.web.SummaryReportResponse;
import com.moneysnapshot.savings.SavingsForecastService;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.security.web.UserSettingsResponse;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.MessageSource;

@ExtendWith(MockitoExtension.class)
class ReportQueryServiceTest {

    private final ReportDailyBalanceCacheRepository dailyBalanceCacheRepository = mock(ReportDailyBalanceCacheRepository.class);
    private final ReportAverageContributionCacheRepository averageContributionCacheRepository = mock(ReportAverageContributionCacheRepository.class);
    private final ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository = mock(ReportFinalSnapshotCacheRepository.class);
    private final ReportCacheRefreshService reportCacheRefreshService = mock(ReportCacheRefreshService.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final UserSettingsService userSettingsService = mock(UserSettingsService.class);
    private final SavingsForecastService savingsForecastService = mock(SavingsForecastService.class);
    private final MessageSource messageSource = mock(MessageSource.class);

    private final ReportQueryService service = new ReportQueryService(
            dailyBalanceCacheRepository,
            averageContributionCacheRepository,
            finalSnapshotCacheRepository,
            reportCacheRefreshService,
            currentUserService,
            userSettingsService,
            savingsForecastService,
            messageSource,
            Clock.fixed(Instant.parse("2026-06-03T00:00:00Z"), ZoneOffset.UTC)
    );

    @Test
    void summaryUsesSnapshotOnFromDateAsStartBalance() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 5, 10);
        LocalDate toDate = LocalDate.of(2026, 5, 12);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(account.getId()).thenReturn(accountId);
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                toDate
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportFinalSnapshotCache(owner, account, bank, toDate, "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));

        SummaryReportResponse response = service.summary("accounts", fromDate, toDate);

        verify(reportCacheRefreshService).ensureOwnerCacheReady(ownerId, LocalDate.of(2026, 6, 3));
        assertThat(response.rows()).hasSize(1);
        SummaryReportResponse.Row row = response.rows().get(0);
        assertThat(row.startBalance()).isEqualByComparingTo("100.00");
        assertThat(row.endBalance()).isEqualByComparingTo("125.00");
        assertThat(row.change()).isEqualByComparingTo("25.00");
        assertThat(row.changePercent()).isEqualByComparingTo("25.00");
        assertThat(row.series().get(0).date()).isEqualTo(fromDate);
        assertThat(row.series().get(0).change()).isEqualByComparingTo("0.00");
        assertThat(row.points().get(0).date()).isEqualTo(fromDate);
        assertThat(row.points().get(0).change()).isEqualByComparingTo("0.00");
    }

    @Test
    void summarySeriesUsesChangePointsAndCheckpointsInsteadOfEveryDayInRange() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 1, 1);
        LocalDate toDate = LocalDate.of(2026, 2, 15);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(account.getId()).thenReturn(accountId);
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                toDate
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportFinalSnapshotCache(owner, account, bank, LocalDate.of(2026, 1, 20), "Main", "Bank", "PLN", new BigDecimal("130.00")),
                new ReportFinalSnapshotCache(owner, account, bank, toDate, "Main", "Bank", "PLN", new BigDecimal("160.00"))
        ));

        SummaryReportResponse response = service.summary("accounts", fromDate, toDate);

        assertThat(response.step()).isEqualTo("week");
        assertThat(response.rows()).hasSize(1);
        SummaryReportResponse.Row row = response.rows().get(0);
        assertThat(row.series()).extracting(SummaryReportResponse.Point::date)
                .containsExactly(
                        LocalDate.of(2026, 1, 1),
                        LocalDate.of(2026, 1, 8),
                        LocalDate.of(2026, 1, 15),
                        LocalDate.of(2026, 1, 20),
                        LocalDate.of(2026, 1, 22),
                        LocalDate.of(2026, 1, 29),
                        LocalDate.of(2026, 2, 5),
                        LocalDate.of(2026, 2, 12),
                        LocalDate.of(2026, 2, 15)
                );
        assertThat(row.series()).hasSize(9);
    }

    @Test
    void summaryIncludesFirstFinalSnapshotWhenLaterPartialSnapshotExistsInPeriod() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 1, 1);
        LocalDate finalSnapshotDate = LocalDate.of(2026, 1, 10);
        LocalDate partialSnapshotDate = LocalDate.of(2026, 1, 12);
        LocalDate toDate = LocalDate.of(2026, 1, 15);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(account.getId()).thenReturn(accountId);
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                toDate
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportFinalSnapshotCache(owner, account, bank, finalSnapshotDate, "Main", "Bank", "PLN", new BigDecimal("150.00"))
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                fromDate,
                toDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, fromDate, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, partialSnapshotDate, partialSnapshotDate, "Main", "Bank", "PLN", new BigDecimal("170.00")),
                new ReportDailyBalanceCache(owner, account, bank, toDate, partialSnapshotDate, "Main", "Bank", "PLN", new BigDecimal("170.00"))
        ));

        SummaryReportResponse response = service.summary("accounts", fromDate, toDate);

        assertThat(response.rows()).hasSize(1);
        SummaryReportResponse.Row row = response.rows().get(0);
        assertThat(row.startBalance()).isEqualByComparingTo("100.00");
        assertThat(row.endBalance()).isEqualByComparingTo("170.00");
        assertThat(row.change()).isEqualByComparingTo("70.00");
        assertThat(row.points()).extracting(SummaryReportResponse.Point::date)
                .containsExactly(fromDate, finalSnapshotDate, partialSnapshotDate, toDate);
        SummaryReportResponse.Point finalPoint = row.points().stream()
                .filter(point -> point.date().equals(finalSnapshotDate))
                .findFirst()
                .orElseThrow();
        assertThat(finalPoint.balance()).isEqualByComparingTo("150.00");
        assertThat(finalPoint.change()).isEqualByComparingTo("50.00");
    }

    @Test
    void summaryUsesExplicitBaselineDateForBillingPeriodChanges() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate baselineDate = LocalDate.of(2026, 5, 6);
        LocalDate fromDate = LocalDate.of(2026, 5, 7);
        LocalDate toDate = LocalDate.of(2026, 6, 6);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(account.getId()).thenReturn(accountId);
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                toDate
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, baselineDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                baselineDate,
                toDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, baselineDate, baselineDate, "Main", "Bank", "PLN", new BigDecimal("120.00")),
                new ReportDailyBalanceCache(owner, account, bank, fromDate, fromDate, "Main", "Bank", "PLN", new BigDecimal("125.00")),
                new ReportDailyBalanceCache(owner, account, bank, toDate, fromDate, "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));

        SummaryReportResponse response = service.summary("accounts", fromDate, toDate, baselineDate);

        SummaryReportResponse.Row row = response.rows().get(0);
        assertThat(row.startBalance()).isEqualByComparingTo("100.00");
        assertThat(row.endBalance()).isEqualByComparingTo("125.00");
        assertThat(row.change()).isEqualByComparingTo("25.00");
        assertThat(row.series()).extracting(SummaryReportResponse.Point::date)
                .startsWith(baselineDate);
        SummaryReportResponse.Point baselinePoint = row.series().stream()
                .filter(point -> point.date().equals(baselineDate))
                .findFirst()
                .orElseThrow();
        SummaryReportResponse.Point firstBillingDayPoint = row.series().stream()
                .filter(point -> point.date().equals(fromDate))
                .findFirst()
                .orElseThrow();
        assertThat(baselinePoint.balance()).isEqualByComparingTo("100.00");
        assertThat(baselinePoint.change()).isEqualByComparingTo("0.00");
        assertThat(firstBillingDayPoint.change()).isEqualByComparingTo("25.00");
    }

    @Test
    void planningTotalsIgnoreMissingValuesInsteadOfTurningWholeRowIntoNoData() {
        UUID ownerId = UUID.randomUUID();
        UUID accountWithMissingCurrentBalanceId = UUID.randomUUID();
        UUID accountWithCurrentBalanceId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        Account accountWithMissingCurrentBalance = mock(Account.class);
        Account accountWithCurrentBalance = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(accountWithMissingCurrentBalance.getId()).thenReturn(accountWithMissingCurrentBalanceId);
        when(accountWithCurrentBalance.getId()).thenReturn(accountWithCurrentBalanceId);
        when(averageContributionCacheRepository.findAllByOwnerIdOrderByAccountNameAsc(ownerId)).thenReturn(List.of(
                new ReportAverageContributionCache(
                        owner,
                        accountWithMissingCurrentBalance,
                        bank,
                        "Missing balance",
                        "Bank",
                        "PLN",
                        new BigDecimal("100.00"),
                        LocalDate.of(2026, 1, 1),
                        LocalDate.of(2026, 1, 31)
                ),
                new ReportAverageContributionCache(
                        owner,
                        accountWithCurrentBalance,
                        bank,
                        "Present balance",
                        "Bank",
                        "PLN",
                        new BigDecimal("200.00"),
                        LocalDate.of(2026, 1, 1),
                        LocalDate.of(2026, 1, 31)
                )
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateOrderByAccountNameAsc(ownerId, LocalDate.of(2026, 6, 3)))
                .thenReturn(List.of(
                        new ReportDailyBalanceCache(
                                owner,
                                accountWithCurrentBalance,
                                bank,
                                LocalDate.of(2026, 6, 3),
                                LocalDate.of(2026, 6, 3),
                                "Present balance",
                                "Bank",
                                "PLN",
                                new BigDecimal("1000.00")
                        )
                ));
        when(savingsForecastService.latestForecast()).thenReturn(Optional.empty());

        PlanningReportResponse response = service.planning();

        assertThat(response.rows()).hasSize(2);
        PlanningReportResponse.Total total = response.totals().get(0);
        assertThat(total.currencyCode()).isEqualTo("PLN");
        assertThat(total.currentBalance()).isEqualByComparingTo("1000.00");
        assertThat(total.averageContribution()).isEqualByComparingTo("300.00");
        assertThat(total.yearlyChange()).isEqualByComparingTo("2400.00");
        assertThat(total.projectedChangePercent()).isEqualByComparingTo("240.00");
        assertThat(total.projectedBalance()).isEqualByComparingTo("3400.00");
    }

    @Test
    void snapshotPanelUsesBillingMonthEndDayToResolvePeriodStart() {
        UUID ownerId = UUID.randomUUID();
        LocalDate today = LocalDate.of(2026, 6, 3);
        LocalDate expectedPeriodStart = LocalDate.of(2026, 5, 7);
        LocalDate previousPeriodEnd = expectedPeriodStart.minusDays(1);
        LocalDate expectedPeriodEnd = LocalDate.of(2026, 6, 6);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                6,
                Map.of()
        ));
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                today
        )).thenReturn(List.of());
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                previousPeriodEnd,
                today
        )).thenReturn(List.of());

        SnapshotPanelResponse response = service.snapshotPanel();

        verify(reportCacheRefreshService).ensureOwnerCacheReady(ownerId, today);
        verify(dailyBalanceCacheRepository).findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                previousPeriodEnd,
                today
        );
        assertThat(response.periodDate()).isEqualTo(expectedPeriodStart);
    }

    @Test
    void snapshotPanelUsesFinalSnapshotAsPeriodBaseline() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate today = LocalDate.of(2026, 6, 3);
        LocalDate periodStart = LocalDate.of(2026, 6, 1);
        LocalDate previousPeriodEnd = periodStart.minusDays(1);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                31,
                Map.of()
        ));
        when(account.getId()).thenReturn(accountId);
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                today
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, previousPeriodEnd, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                previousPeriodEnd,
                today
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, previousPeriodEnd, previousPeriodEnd, "Main", "Bank", "PLN", new BigDecimal("125.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, today, "Main", "Bank", "PLN", new BigDecimal("150.00"))
        ));

        SnapshotPanelResponse response = service.snapshotPanel();

        assertThat(response.monthlyChanges()).hasSize(1);
        assertThat(response.monthlyChanges().get(0).amount()).isEqualByComparingTo("50.00");
        assertThat(response.monthlyChangePercent()).isEqualByComparingTo("50.0");
        assertThat(response.chartPoints().get(0).amount()).isEqualByComparingTo("0.00");
    }

    @Test
    void snapshotPanelIgnoresFutureFinalSnapshotInCurrentValues() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate today = LocalDate.of(2026, 6, 3);
        LocalDate periodStart = LocalDate.of(2026, 6, 1);
        LocalDate previousPeriodEnd = periodStart.minusDays(1);
        LocalDate futureSnapshotDate = LocalDate.of(2026, 6, 20);
        LocalDate periodEnd = LocalDate.of(2026, 6, 30);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                31,
                Map.of()
        ));
        when(account.getId()).thenReturn(accountId);
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                today
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, previousPeriodEnd, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                previousPeriodEnd,
                today
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, previousPeriodEnd, previousPeriodEnd, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, today, "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));

        SnapshotPanelResponse response = service.snapshotPanel();

        verify(finalSnapshotCacheRepository).findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                today
        );
        assertThat(response.currentBalances()).hasSize(1);
        assertThat(response.currentBalances().get(0).amount()).isEqualByComparingTo("125.00");
        assertThat(response.monthlyChanges().get(0).amount()).isEqualByComparingTo("25.00");
        SnapshotPanelChartPointResponse futureAxisPoint = response.chartPoints().stream()
                .filter(point -> point.date().equals(futureSnapshotDate))
                .findFirst()
                .orElseThrow();
        assertThat(futureAxisPoint.amount()).isEqualByComparingTo("25.00");
        assertThat(futureAxisPoint.type()).isEqualTo("balance");
        assertThat(response.chartPoints().get(response.chartPoints().size() - 1).date()).isEqualTo(periodEnd);
        assertThat(response.chartPoints().get(response.chartPoints().size() - 1).amount()).isEqualByComparingTo("25.00");
    }

    @Test
    void overviewFallsBackToLatestAvailableBalanceDateWhenRequestedDateHasNoCacheRows() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate requestedDate = LocalDate.of(2026, 6, 6);
        LocalDate availableDate = LocalDate.of(2026, 6, 5);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(dailyBalanceCacheRepository.findLatestBalanceDateOnOrBefore(ownerId, requestedDate)).thenReturn(java.util.Optional.of(availableDate));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                availableDate,
                availableDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, availableDate, LocalDate.of(2026, 6, 1), "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));

        OverviewReportResponse response = service.overview("accounts", requestedDate);

        assertThat(response.rows()).hasSize(1);
        assertThat(response.rows().get(0).balance()).isEqualByComparingTo("125.00");
        assertThat(response.rows().get(0).sharePercent()).isEqualByComparingTo("100.00");
    }

    @Test
    void snapshotPanelChartAppendsEndPointWhenPeriodEndsInFuture() {
        UUID ownerId = UUID.randomUUID();
        LocalDate periodDate = LocalDate.of(2026, 6, 1);
        LocalDate startDate = periodDate.minusDays(1);
        LocalDate today = LocalDate.of(2026, 6, 3);
        LocalDate endDate = periodDate.plusMonths(1).minusDays(1);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                30,
                Map.of()
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                today
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, startDate, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, today, "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                today
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));

        List<SnapshotPanelChartPointResponse> points = service.snapshotPanelChart(periodDate);

        SnapshotPanelChartPointResponse todayPoint = points.stream()
                .filter(point -> point.date().equals(today))
                .findFirst()
                .orElseThrow();
        assertThat(points.get(0).date()).isEqualTo(startDate);
        assertThat(points.get(0).amount()).isEqualByComparingTo("0.00");
        assertThat(todayPoint.type()).isEqualTo("snapshot-today");
        assertThat(todayPoint.amount()).isEqualByComparingTo("25.00");
        assertThat(points.get(points.size() - 1).date()).isEqualTo(endDate);
        assertThat(points.get(points.size() - 1).type()).isEqualTo("end");
        assertThat(points.get(points.size() - 1).amount()).isEqualByComparingTo("25.00");
    }

    @Test
    void snapshotPanelChartEndsOnConfiguredBillingEndDayWhenPreviousMonthWasClamped() {
        UUID ownerId = UUID.randomUUID();
        LocalDate periodDate = LocalDate.of(2026, 3, 1);
        LocalDate startDate = LocalDate.of(2026, 2, 28);
        LocalDate endDate = LocalDate.of(2026, 3, 30);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                30,
                Map.of()
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                endDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, startDate, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                endDate
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));

        List<SnapshotPanelChartPointResponse> points = service.snapshotPanelChart(periodDate);

        verify(dailyBalanceCacheRepository).findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                endDate
        );
        assertThat(points.get(0).date()).isEqualTo(startDate);
        assertThat(points.get(points.size() - 1).date()).isEqualTo(endDate);
    }

    @Test
    void snapshotPanelChartMarksCarriedForwardTodayPointAsToday() {
        UUID ownerId = UUID.randomUUID();
        LocalDate periodDate = LocalDate.of(2026, 6, 1);
        LocalDate startDate = periodDate.minusDays(1);
        LocalDate today = LocalDate.of(2026, 6, 3);
        LocalDate endDate = periodDate.plusMonths(1).minusDays(1);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                30,
                Map.of()
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                today
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, startDate, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, LocalDate.of(2026, 6, 1), "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                today
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));

        List<SnapshotPanelChartPointResponse> points = service.snapshotPanelChart(periodDate);

        SnapshotPanelChartPointResponse todayPoint = points.stream()
                .filter(point -> point.date().equals(today))
                .findFirst()
                .orElseThrow();
        assertThat(todayPoint.type()).isEqualTo("snapshot-today");
    }

    @Test
    void snapshotPanelChartDoesNotMarkCarriedForwardPastDayAsSnapshot() {
        UUID ownerId = UUID.randomUUID();
        LocalDate periodDate = LocalDate.of(2026, 6, 1);
        LocalDate startDate = periodDate.minusDays(1);
        LocalDate carriedForwardDate = LocalDate.of(2026, 6, 2);
        LocalDate today = LocalDate.of(2026, 6, 3);
        LocalDate endDate = periodDate.plusMonths(1).minusDays(1);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse(
                "PLN",
                "light",
                "Y-m-d H:m",
                "### ###,00 zl",
                30,
                Map.of()
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                today
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, startDate, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, carriedForwardDate, LocalDate.of(2026, 6, 1), "Main", "Bank", "PLN", new BigDecimal("125.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, LocalDate.of(2026, 6, 1), "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                today
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));

        List<SnapshotPanelChartPointResponse> points = service.snapshotPanelChart(periodDate);

        SnapshotPanelChartPointResponse carriedForwardPoint = points.stream()
                .filter(point -> point.date().equals(carriedForwardDate))
                .findFirst()
                .orElseThrow();
        SnapshotPanelChartPointResponse todayPoint = points.stream()
                .filter(point -> point.date().equals(today))
                .findFirst()
                .orElseThrow();
        assertThat(carriedForwardPoint.type()).isEqualTo("balance");
        assertThat(todayPoint.type()).isEqualTo("snapshot-today");
    }

    @Test
    void historyUsesPreviousDayBalanceForFirstDiffInRange() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 5, 10);
        LocalDate toDate = LocalDate.of(2026, 5, 11);
        LocalDate previousDate = fromDate.minusDays(1);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(account.getId()).thenReturn(accountId);
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateOrderByAccountNameAsc(ownerId, previousDate))
                .thenReturn(List.of(
                        new ReportDailyBalanceCache(owner, account, bank, previousDate, previousDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
                ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, fromDate, toDate))
                .thenReturn(List.of(
                        new ReportDailyBalanceCache(owner, account, bank, fromDate, fromDate, "Main", "Bank", "PLN", new BigDecimal("125.00")),
                        new ReportDailyBalanceCache(owner, account, bank, toDate, toDate, "Main", "Bank", "PLN", new BigDecimal("130.00"))
                ));

        HistoryReportResponse response = service.history(fromDate, toDate, 0, 10);

        assertThat(response.rows()).hasSize(2);
        HistoryReportResponse.Row firstInRangeRow = response.rows().get(1);
        assertThat(firstInRangeRow.date()).isEqualTo(fromDate);
        assertThat(firstInRangeRow.values()).hasSize(1);
        assertThat(firstInRangeRow.values().get(0).balance()).isEqualByComparingTo("125.00");
        assertThat(firstInRangeRow.values().get(0).diff()).isEqualByComparingTo("25.00");
    }

    @Test
    void historyShowsOnlyActualSnapshotDatesNotCarriedForwardCacheDays() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 5, 10);
        LocalDate toDate = LocalDate.of(2026, 5, 15);
        LocalDate previousDate = fromDate.minusDays(1);
        AppUser owner = mock(AppUser.class);
        Account account = mock(Account.class);
        Bank bank = mock(Bank.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(account.getId()).thenReturn(accountId);
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateOrderByAccountNameAsc(ownerId, previousDate))
                .thenReturn(List.of(
                        new ReportDailyBalanceCache(owner, account, bank, previousDate, previousDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
                ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndAccountShowInSnapshotsTrueAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, fromDate, toDate))
                .thenReturn(List.of(
                        new ReportDailyBalanceCache(owner, account, bank, fromDate, fromDate, "Main", "Bank", "PLN", new BigDecimal("125.00")),
                        new ReportDailyBalanceCache(owner, account, bank, LocalDate.of(2026, 5, 11), fromDate, "Main", "Bank", "PLN", new BigDecimal("125.00")),
                        new ReportDailyBalanceCache(owner, account, bank, LocalDate.of(2026, 5, 12), fromDate, "Main", "Bank", "PLN", new BigDecimal("125.00")),
                        new ReportDailyBalanceCache(owner, account, bank, LocalDate.of(2026, 5, 14), LocalDate.of(2026, 5, 14), "Main", "Bank", "PLN", new BigDecimal("140.00")),
                        new ReportDailyBalanceCache(owner, account, bank, toDate, LocalDate.of(2026, 5, 14), "Main", "Bank", "PLN", new BigDecimal("140.00"))
                ));

        HistoryReportResponse response = service.history(fromDate, toDate, 0, 10);

        assertThat(response.rows()).extracting(HistoryReportResponse.Row::date)
                .containsExactly(LocalDate.of(2026, 5, 14), fromDate);
        assertThat(response.rows().get(0).values().get(0).diff()).isEqualByComparingTo("15.00");
        assertThat(response.rows().get(1).values().get(0).diff()).isEqualByComparingTo("25.00");
    }
}
