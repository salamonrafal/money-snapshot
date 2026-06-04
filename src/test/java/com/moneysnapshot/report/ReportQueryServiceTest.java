package com.moneysnapshot.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.dashboard.SnapshotPanelChartPointResponse;
import com.moneysnapshot.report.web.HistoryReportResponse;
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
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                toDate
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                fromDate,
                toDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, fromDate, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, toDate, toDate, "Main", "Bank", "PLN", new BigDecimal("125.00"))
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
        when(finalSnapshotCacheRepository.findAllByOwnerIdAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(
                ownerId,
                LocalDate.of(1900, 1, 1),
                toDate
        )).thenReturn(List.of(
                new ReportFinalSnapshotCache(owner, account, bank, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00"))
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                fromDate,
                toDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, fromDate, fromDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, LocalDate.of(2026, 1, 20), LocalDate.of(2026, 1, 20), "Main", "Bank", "PLN", new BigDecimal("130.00")),
                new ReportDailyBalanceCache(owner, account, bank, toDate, toDate, "Main", "Bank", "PLN", new BigDecimal("160.00"))
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
                1,
                Map.of()
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                endDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, startDate, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, today, "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));

        List<SnapshotPanelChartPointResponse> points = service.snapshotPanelChart(periodDate);

        assertThat(points).extracting(SnapshotPanelChartPointResponse::date)
                .containsExactly(startDate, today, endDate);
        assertThat(points).extracting(SnapshotPanelChartPointResponse::type)
                .containsExactly("baseline", "snapshot-today", "end");
        assertThat(points.get(2).amount()).isEqualByComparingTo("125.00");
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
                1,
                Map.of()
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                endDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, startDate, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, LocalDate.of(2026, 6, 1), "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));

        List<SnapshotPanelChartPointResponse> points = service.snapshotPanelChart(periodDate);

        assertThat(points).extracting(SnapshotPanelChartPointResponse::date)
                .containsExactly(startDate, today, endDate);
        assertThat(points).extracting(SnapshotPanelChartPointResponse::type)
                .containsExactly("baseline", "today", "end");
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
                1,
                Map.of()
        ));
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(
                ownerId,
                startDate,
                endDate
        )).thenReturn(List.of(
                new ReportDailyBalanceCache(owner, account, bank, startDate, startDate, "Main", "Bank", "PLN", new BigDecimal("100.00")),
                new ReportDailyBalanceCache(owner, account, bank, carriedForwardDate, LocalDate.of(2026, 6, 1), "Main", "Bank", "PLN", new BigDecimal("125.00")),
                new ReportDailyBalanceCache(owner, account, bank, today, LocalDate.of(2026, 6, 1), "Main", "Bank", "PLN", new BigDecimal("125.00"))
        ));

        List<SnapshotPanelChartPointResponse> points = service.snapshotPanelChart(periodDate);

        assertThat(points).extracting(SnapshotPanelChartPointResponse::date)
                .containsExactly(startDate, carriedForwardDate, today, endDate);
        assertThat(points).extracting(SnapshotPanelChartPointResponse::type)
                .containsExactly("baseline", "balance", "today", "end");
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
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, fromDate, toDate))
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
        when(dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, fromDate, toDate))
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
