package com.moneysnapshot.report;

import com.moneysnapshot.dashboard.SnapshotPanelAmountResponse;
import com.moneysnapshot.dashboard.SnapshotPanelChartPointResponse;
import com.moneysnapshot.dashboard.SnapshotPanelResponse;
import com.moneysnapshot.report.web.AverageContributionReportResponse;
import com.moneysnapshot.report.web.HistoryReportResponse;
import com.moneysnapshot.report.web.OverviewReportResponse;
import com.moneysnapshot.report.web.PlanningReportResponse;
import com.moneysnapshot.report.web.SummaryReportResponse;
import com.moneysnapshot.savings.SavingsForecastService;
import com.moneysnapshot.savings.web.SavingsForecastEntryResponse;
import com.moneysnapshot.savings.web.SavingsForecastMonthValueResponse;
import com.moneysnapshot.savings.web.SavingsForecastRunResponse;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.context.i18n.LocaleContextHolder;

@Service
public class ReportQueryService {

    private final ReportDailyBalanceCacheRepository dailyBalanceCacheRepository;
    private final ReportAverageContributionCacheRepository averageContributionCacheRepository;
    private final ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository;
    private final ReportCacheRefreshService reportCacheRefreshService;
    private final CurrentUserService currentUserService;
    private final UserSettingsService userSettingsService;
    private final SavingsForecastService savingsForecastService;
    private final MessageSource messageSource;
    private final Clock clock;

    @Autowired
    public ReportQueryService(
            ReportDailyBalanceCacheRepository dailyBalanceCacheRepository,
            ReportAverageContributionCacheRepository averageContributionCacheRepository,
            ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository,
            ReportCacheRefreshService reportCacheRefreshService,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService,
            SavingsForecastService savingsForecastService,
            MessageSource messageSource
    ) {
        this(
                dailyBalanceCacheRepository,
                averageContributionCacheRepository,
                finalSnapshotCacheRepository,
                reportCacheRefreshService,
                currentUserService,
                userSettingsService,
                savingsForecastService,
                messageSource,
                Clock.systemUTC()
        );
    }

    ReportQueryService(
            ReportDailyBalanceCacheRepository dailyBalanceCacheRepository,
            ReportAverageContributionCacheRepository averageContributionCacheRepository,
            ReportFinalSnapshotCacheRepository finalSnapshotCacheRepository,
            ReportCacheRefreshService reportCacheRefreshService,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService,
            SavingsForecastService savingsForecastService,
            MessageSource messageSource,
            Clock clock
    ) {
        this.dailyBalanceCacheRepository = dailyBalanceCacheRepository;
        this.averageContributionCacheRepository = averageContributionCacheRepository;
        this.finalSnapshotCacheRepository = finalSnapshotCacheRepository;
        this.reportCacheRefreshService = reportCacheRefreshService;
        this.currentUserService = currentUserService;
        this.userSettingsService = userSettingsService;
        this.savingsForecastService = savingsForecastService;
        this.messageSource = messageSource;
        this.clock = clock;
    }

    public SnapshotPanelResponse snapshotPanel() {
        UUID ownerId = currentUserService.currentUserId();
        LocalDate today = LocalDate.now(clock);
        reportCacheRefreshService.ensureOwnerCacheReady(ownerId, today);
        LocalDate periodDate = resolvePeriodStart(today, userSettingsService.currentUserSettings().billingMonthStartDay());
        List<ReportDailyBalanceCache> currentRows = dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateOrderByAccountNameAsc(ownerId, today);
        List<ReportDailyBalanceCache> previousRows = dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateOrderByAccountNameAsc(ownerId, periodDate.minusDays(1));
        List<SnapshotPanelAmountResponse> currentBalances = sumByCurrency(currentRows);
        List<SnapshotPanelAmountResponse> monthlyChanges = subtractByCurrency(currentBalances, sumByCurrency(previousRows));
        return new SnapshotPanelResponse(
                periodDate,
                calculateMonthlyChangePercent(currentBalances, sumByCurrency(previousRows)),
                dailyBalanceCacheRepository.countTrackedAccounts(ownerId, today),
                currentBalances,
                monthlyChanges,
                snapshotPanelChart(periodDate)
        );
    }

    public List<SnapshotPanelChartPointResponse> snapshotPanelChart(LocalDate periodDate) {
        UUID ownerId = currentUserService.currentUserId();
        LocalDate startDate = periodDate.minusDays(1);
        LocalDate endDate = periodDate.plusMonths(1).minusDays(1);
        List<ReportDailyBalanceCache> rows = dailyBalanceCacheRepository
                .findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, startDate, endDate);
        if (rows.isEmpty()) {
            return List.of();
        }

        String preferredCurrency = resolvePreferredCurrency(rows);
        Map<LocalDate, BigDecimal> balanceByDate = rows.stream()
                .filter(row -> preferredCurrency.equals(row.getCurrencyCode()))
                .collect(java.util.stream.Collectors.groupingBy(
                        ReportDailyBalanceCache::getBalanceDate,
                        LinkedHashMap::new,
                        java.util.stream.Collectors.mapping(ReportDailyBalanceCache::getBalance, java.util.stream.Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))
                ));
        if (!balanceByDate.containsKey(endDate)) {
            balanceByDate.entrySet().stream()
                    .reduce((left, right) -> right)
                    .ifPresent(lastEntry -> balanceByDate.put(endDate, lastEntry.getValue()));
        }

        List<SnapshotPanelChartPointResponse> points = new ArrayList<>();
        LocalDate today = LocalDate.now(clock);
        for (Map.Entry<LocalDate, BigDecimal> entry : balanceByDate.entrySet()) {
            String type = "snapshot";
            if (entry.getKey().equals(startDate)) {
                type = "baseline";
            } else if (entry.getKey().equals(today)) {
                type = "snapshot-today";
            } else if (entry.getKey().equals(endDate)) {
                type = "end";
            }
            points.add(new SnapshotPanelChartPointResponse(entry.getKey(), entry.getValue(), preferredCurrency, type));
        }
        return points;
    }

    public SummaryReportResponse summary(String scope, LocalDate fromDate, LocalDate toDate) {
        ensureCurrentOwnerCache();
        String step = resolveStep(fromDate, toDate);
        List<LocalDate> checkpoints = buildCheckpoints(fromDate, toDate, step);
        List<EntrySeries> entries = buildSummaryEntrySeries(scope, fromDate, toDate);
        List<SummaryReportResponse.Row> rows = entries.stream()
                .map(entry -> {
                    BigDecimal startBalance = entry.startBalance();
                    BigDecimal endBalance = entry.endBalance();
                    BigDecimal change = endBalance.subtract(startBalance);
                    BigDecimal changePercent = startBalance.compareTo(BigDecimal.ZERO) == 0
                            ? null
                            : change.multiply(BigDecimal.valueOf(100)).divide(startBalance, 2, RoundingMode.HALF_UP);
                    List<LocalDate> seriesDates = new ArrayList<>();
                    seriesDates.add(fromDate);
                    seriesDates.addAll(checkpoints);
                    seriesDates.addAll(entry.pointDates().stream()
                            .filter(date -> !date.isBefore(fromDate) && !date.isAfter(toDate))
                            .toList());
                    seriesDates.add(toDate);
                    List<LocalDate> distinctDates = seriesDates.stream().distinct().sorted().toList();
                    Map<LocalDate, BigDecimal> balanceByDate = entry.balanceByDate();
                    List<SummaryReportResponse.Point> series = distinctDates.stream()
                            .map(date -> {
                                BigDecimal balance = balanceByDate.getOrDefault(date, BigDecimal.ZERO);
                                return new SummaryReportResponse.Point(date, balance, balance.subtract(startBalance));
                            })
                            .toList();
                    List<SummaryReportResponse.Point> points = entry.pointDates().stream()
                            .filter(date -> !date.isBefore(fromDate) && !date.isAfter(toDate))
                            .sorted()
                            .map(date -> {
                                BigDecimal balance = balanceByDate.getOrDefault(date, BigDecimal.ZERO);
                                return new SummaryReportResponse.Point(date, balance, balance.subtract(startBalance));
                            })
                            .toList();
                    return new SummaryReportResponse.Row(entry.name(), entry.currencyCode(), startBalance, endBalance, change, changePercent, points, series);
                })
                .sorted(Comparator.comparing(SummaryReportResponse.Row::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(SummaryReportResponse.Row::currencyCode))
                .toList();
        return new SummaryReportResponse(rows, step, checkpoints);
    }

    public OverviewReportResponse overview(String scope, LocalDate toDate) {
        ensureCurrentOwnerCache();
        List<EntrySeries> entries = buildEntrySeries(scope, toDate, toDate);
        BigDecimal total = entries.stream()
                .map(entry -> balanceAt(entry.balanceByDate(), toDate).abs())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<OverviewReportResponse.Row> rows = entries.stream()
                .map(entry -> {
                    BigDecimal balance = balanceAt(entry.balanceByDate(), toDate);
                    BigDecimal sharePercent = total.compareTo(BigDecimal.ZERO) == 0
                            ? null
                            : balance.abs().multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP);
                    return new OverviewReportResponse.Row(entry.name(), entry.currencyCode(), balance, sharePercent);
                })
                .filter(row -> row.balance().compareTo(BigDecimal.ZERO) != 0)
                .sorted(Comparator.comparing(OverviewReportResponse.Row::balance).reversed())
                .toList();
        return new OverviewReportResponse(rows);
    }

    public AverageContributionReportResponse averageContributions() {
        ensureCurrentOwnerCache();
        UUID ownerId = currentUserService.currentUserId();
        List<ReportAverageContributionCache> rows = averageContributionCacheRepository.findAllByOwnerIdOrderByAccountNameAsc(ownerId);
        List<AverageContributionReportResponse.Row> responseRows = rows.stream()
                .map(row -> new AverageContributionReportResponse.Row(
                        row.getAccountId(),
                        row.getAccountName(),
                        row.getBankName(),
                        row.getCurrencyCode(),
                        row.getAverageContribution(),
                        row.getSampleFromDate(),
                        row.getSampleToDate()
                ))
                .toList();

        List<AverageContributionReportResponse.Total> totals = responseRows.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        AverageContributionReportResponse.Row::currencyCode,
                        LinkedHashMap::new,
                        java.util.stream.Collectors.mapping(
                                AverageContributionReportResponse.Row::averageContribution,
                                java.util.stream.Collectors.reducing(BigDecimal.ZERO, BigDecimal::add)
                        )
                ))
                .entrySet().stream()
                .map(entry -> new AverageContributionReportResponse.Total(entry.getKey(), entry.getValue()))
                .toList();
        return new AverageContributionReportResponse(responseRows, totals);
    }

    public PlanningReportResponse planning() {
        ensureCurrentOwnerCache();
        AverageContributionReportResponse average = averageContributions();
        Map<String, AverageContributionReportResponse.Row> averageByKey = average.rows().stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> key(row.accountId(), row.currencyCode()),
                        row -> row
                ));

        UUID ownerId = currentUserService.currentUserId();
        LocalDate today = LocalDate.now(clock);
        List<ReportDailyBalanceCache> latestBalances = dailyBalanceCacheRepository.findAllByOwnerIdAndBalanceDateOrderByAccountNameAsc(ownerId, today);
        Map<String, ReportDailyBalanceCache> latestByKey = latestBalances.stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> key(row.getAccount().getId(), row.getCurrencyCode()),
                        row -> row,
                        (left, right) -> right,
                        LinkedHashMap::new
                ));

        Map<String, PlannedBalance> currentPlans = new HashMap<>();
        Map<String, PlannedBalance> yearlyPlans = new HashMap<>();
        savingsForecastService.latestForecast().ifPresent(forecast -> populatePlanningMaps(today, forecast, currentPlans, yearlyPlans));

        List<String> allKeys = new ArrayList<>();
        allKeys.addAll(averageByKey.keySet());
        allKeys.addAll(latestByKey.keySet());
        allKeys.addAll(currentPlans.keySet());
        allKeys.addAll(yearlyPlans.keySet());

        List<PlanningReportResponse.Row> rows = allKeys.stream().distinct()
                .map(cacheKey -> planningRow(cacheKey, averageByKey, latestByKey, currentPlans, yearlyPlans))
                .sorted(Comparator.comparing(PlanningReportResponse.Row::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(PlanningReportResponse.Row::currencyCode))
                .toList();

        List<PlanningReportResponse.Total> totals = buildPlanningTotals(rows);
        return new PlanningReportResponse(rows, totals);
    }

    public HistoryReportResponse history(LocalDate fromDate, LocalDate toDate, int page, int size) {
        ensureCurrentOwnerCache();
        UUID ownerId = currentUserService.currentUserId();
        List<ReportDailyBalanceCache> rows = dailyBalanceCacheRepository
                .findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, fromDate, toDate);
        Map<UUID, HistoryReportResponse.Account> accountsById = new LinkedHashMap<>();
        Map<String, BigDecimal> previousByKey = new HashMap<>();
        Map<LocalDate, Map<UUID, HistoryReportResponse.Value>> valuesByDate = new LinkedHashMap<>();

        rows.forEach(row -> {
            accountsById.putIfAbsent(
                    row.getAccount().getId(),
                    new HistoryReportResponse.Account(row.getAccount().getId(), row.getAccountName(), row.getBankName(), row.getCurrencyCode())
            );
            String cacheKey = key(row.getAccount().getId(), row.getCurrencyCode());
            BigDecimal previous = previousByKey.get(cacheKey);
            valuesByDate.computeIfAbsent(row.getBalanceDate(), ignored -> new LinkedHashMap<>())
                    .put(row.getAccount().getId(), new HistoryReportResponse.Value(
                            row.getBalance(),
                            previous == null ? row.getBalance() : row.getBalance().subtract(previous)
                    ));
            previousByKey.put(cacheKey, row.getBalance());
        });

        List<HistoryReportResponse.Account> accounts = accountsById.values().stream()
                .sorted(Comparator.comparing(HistoryReportResponse.Account::accountName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(HistoryReportResponse.Account::currencyCode))
                .toList();
        List<HistoryReportResponse.Row> historyRows = valuesByDate.entrySet().stream()
                .sorted(Map.Entry.<LocalDate, Map<UUID, HistoryReportResponse.Value>>comparingByKey().reversed())
                .map(entry -> new HistoryReportResponse.Row(
                        entry.getKey(),
                        accounts.stream().map(account -> entry.getValue().get(account.id())).toList()
                ))
                .toList();

        int totalElements = historyRows.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalElements / (double) size));
        int safePage = Math.max(0, Math.min(page, totalPages - 1));
        int fromIndex = Math.min(safePage * size, totalElements);
        int toIndex = Math.min(fromIndex + size, totalElements);

        return new HistoryReportResponse(
                accounts,
                historyRows.subList(fromIndex, toIndex),
                safePage,
                size,
                totalElements,
                totalPages,
                safePage == 0,
                safePage >= totalPages - 1
        );
    }

    private PlanningReportResponse.Row planningRow(
            String cacheKey,
            Map<String, AverageContributionReportResponse.Row> averageByKey,
            Map<String, ReportDailyBalanceCache> latestByKey,
            Map<String, PlannedBalance> currentPlans,
            Map<String, PlannedBalance> yearlyPlans
    ) {
        AverageContributionReportResponse.Row average = averageByKey.get(cacheKey);
        ReportDailyBalanceCache latest = latestByKey.get(cacheKey);
        PlannedBalance currentPlan = currentPlans.get(cacheKey);
        PlannedBalance yearlyPlan = yearlyPlans.get(cacheKey);
        BigDecimal currentBalance = latest == null ? null : latest.getBalance();
        BigDecimal averageContribution = average == null ? null : average.averageContribution();
        BigDecimal yearlyChange = averageContribution == null ? null : averageContribution.multiply(BigDecimal.valueOf(12));
        BigDecimal projectedBalance = currentBalance == null || yearlyChange == null ? null : currentBalance.add(yearlyChange);
        BigDecimal currentPlannedBalance = currentPlan == null ? null : currentPlan.balance();
        BigDecimal plannedBalance = yearlyPlan == null ? null : yearlyPlan.balance();
        BigDecimal currentDifference = currentBalance == null || currentPlannedBalance == null ? null : currentBalance.subtract(currentPlannedBalance);
        BigDecimal plannedDifference = projectedBalance == null || plannedBalance == null ? null : projectedBalance.subtract(plannedBalance);
        String name = latest != null ? latest.getAccountName() : average != null ? average.name() : currentPlan != null ? currentPlan.accountName() : yearlyPlan.accountName();
        String bankName = latest != null ? latest.getBankName() : average != null ? average.bankName() : currentPlan != null ? currentPlan.bankName() : yearlyPlan.bankName();
        String currencyCode = latest != null ? latest.getCurrencyCode() : average != null ? average.currencyCode() : currentPlan != null ? currentPlan.currencyCode() : yearlyPlan.currencyCode();
        UUID accountId = latest != null ? latest.getAccount().getId() : average != null ? average.accountId() : currentPlan != null ? currentPlan.accountId() : yearlyPlan.accountId();

        return new PlanningReportResponse.Row(
                accountId,
                name == null ? "" : name,
                bankName == null ? "" : bankName,
                currencyCode == null ? "" : currencyCode,
                averageContribution,
                currentBalance,
                currentPlannedBalance,
                currentDifference,
                projectedBalance,
                yearlyChange,
                currentBalance == null || yearlyChange == null || currentBalance.compareTo(BigDecimal.ZERO) == 0
                        ? null
                        : yearlyChange.multiply(BigDecimal.valueOf(100)).divide(currentBalance, 2, RoundingMode.HALF_UP),
                plannedBalance,
                plannedDifference
        );
    }

    private List<PlanningReportResponse.Total> buildPlanningTotals(List<PlanningReportResponse.Row> rows) {
        Map<String, List<PlanningReportResponse.Row>> rowsByCurrency = rows.stream()
                .collect(java.util.stream.Collectors.groupingBy(PlanningReportResponse.Row::currencyCode, LinkedHashMap::new, java.util.stream.Collectors.toList()));
        List<PlanningReportResponse.Total> totals = new ArrayList<>();
        rowsByCurrency.forEach((currencyCode, currencyRows) -> {
            totals.add(new PlanningReportResponse.Total(
                    currencyCode,
                    aggregate(currencyRows, PlanningReportResponse.Row::currentBalance),
                    aggregate(currencyRows, PlanningReportResponse.Row::currentPlannedBalance),
                    aggregate(currencyRows, PlanningReportResponse.Row::currentDifferenceToPlan),
                    aggregate(currencyRows, PlanningReportResponse.Row::averageContribution),
                    aggregate(currencyRows, PlanningReportResponse.Row::projectedBalance),
                    aggregate(currencyRows, PlanningReportResponse.Row::yearlyChange),
                    percent(aggregate(currencyRows, PlanningReportResponse.Row::yearlyChange), aggregate(currencyRows, PlanningReportResponse.Row::currentBalance)),
                    aggregate(currencyRows, PlanningReportResponse.Row::plannedBalance),
                    aggregate(currencyRows, PlanningReportResponse.Row::differenceToPlan)
            ));
        });
        return totals;
    }

    private void populatePlanningMaps(
            LocalDate today,
            SavingsForecastRunResponse forecast,
            Map<String, PlannedBalance> currentPlans,
            Map<String, PlannedBalance> yearlyPlans
    ) {
        LocalDate yearlyTargetMonth = today.plusMonths(11);
        for (SavingsForecastEntryResponse entry : forecast.entries()) {
            String cacheKey = key(entry.accountId(), entry.currencyCode());
            SavingsForecastMonthValueResponse current = null;
            SavingsForecastMonthValueResponse yearly = null;
            for (SavingsForecastMonthValueResponse month : entry.monthlyBalances()) {
                if (!month.forecastMonth().isAfter(today)) {
                    current = month;
                }
                if (!month.forecastMonth().isAfter(yearlyTargetMonth)) {
                    yearly = month;
                }
            }
            if (current != null) {
                currentPlans.put(cacheKey, new PlannedBalance(entry.accountId(), entry.accountName(), entry.bankName(), entry.currencyCode(), current.balance()));
            }
            if (yearly != null) {
                yearlyPlans.put(cacheKey, new PlannedBalance(entry.accountId(), entry.accountName(), entry.bankName(), entry.currencyCode(), yearly.balance()));
            }
        }
    }

    private List<EntrySeries> buildEntrySeries(String scope, LocalDate fromDate, LocalDate toDate) {
        UUID ownerId = currentUserService.currentUserId();
        String totalAccountsLabel = totalAccountsLabel();
        List<ReportDailyBalanceCache> rows = dailyBalanceCacheRepository
                .findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, fromDate, toDate);
        Map<String, Map<LocalDate, BigDecimal>> balancesByEntry = new LinkedHashMap<>();
        Map<String, EntryMeta> metaByEntry = new LinkedHashMap<>();

        rows.forEach(row -> {
            String entryKey = switch (scope == null ? "accounts" : scope) {
                case "banks" -> row.getBankName() + "|" + row.getCurrencyCode();
                case "total" -> "TOTAL|" + row.getCurrencyCode();
                default -> row.getAccountName() + "|" + row.getCurrencyCode();
            };
            String name = switch (scope == null ? "accounts" : scope) {
                case "banks" -> row.getBankName();
                case "total" -> totalAccountsLabel;
                default -> row.getAccountName();
            };
            balancesByEntry.computeIfAbsent(entryKey, ignored -> new LinkedHashMap<>())
                    .merge(row.getBalanceDate(), row.getBalance(), BigDecimal::add);
            metaByEntry.putIfAbsent(entryKey, new EntryMeta(name, row.getCurrencyCode()));
        });

        return balancesByEntry.entrySet().stream()
                .map(entry -> {
                    BigDecimal balance = balanceAt(entry.getValue(), toDate);
                    return new EntrySeries(
                            metaByEntry.get(entry.getKey()).name(),
                            metaByEntry.get(entry.getKey()).currencyCode(),
                            BigDecimal.ZERO,
                            balance,
                            entry.getValue(),
                            new java.util.LinkedHashSet<>(entry.getValue().keySet())
                    );
                })
                .toList();
    }

    private List<EntrySeries> buildSummaryEntrySeries(String scope, LocalDate fromDate, LocalDate toDate) {
        UUID ownerId = currentUserService.currentUserId();
        List<ReportFinalSnapshotCache> snapshots = finalSnapshotCacheRepository
                .findAllByOwnerIdAndSnapshotDateBetweenOrderBySnapshotDateAscAccountNameAsc(ownerId, LocalDate.of(1900, 1, 1), toDate);

        Map<UUID, AccountSummarySeries> byAccountId = new LinkedHashMap<>();
        snapshots.forEach(snapshot -> byAccountId.computeIfAbsent(
                snapshot.getAccount().getId(),
                ignored -> new AccountSummarySeries(snapshot.getAccount().getId(), snapshot.getAccountName(), snapshot.getBankName(), snapshot.getCurrencyCode())
        ).snapshots().add(new SummarySnapshot(snapshot.getSnapshotDate(), snapshot.getBalance())));

        byAccountId.values().forEach(series -> series.snapshots().sort(Comparator.comparing(SummarySnapshot::date)));

        List<ReportDailyBalanceCache> dailyRows = dailyBalanceCacheRepository
                .findAllByOwnerIdAndBalanceDateBetweenOrderByBalanceDateAscAccountNameAsc(ownerId, fromDate, toDate);
        dailyRows.forEach(row -> byAccountId.computeIfAbsent(
                row.getAccount().getId(),
                ignored -> new AccountSummarySeries(row.getAccount().getId(), row.getAccountName(), row.getBankName(), row.getCurrencyCode())
        ).dailyBalances().put(row.getBalanceDate(), row.getBalance()));
        dailyRows.stream()
                .filter(row -> !row.getLatestSnapshotDate().isBefore(fromDate) && !row.getLatestSnapshotDate().isAfter(toDate))
                .forEach(row -> byAccountId.computeIfAbsent(
                        row.getAccount().getId(),
                        ignored -> new AccountSummarySeries(row.getAccount().getId(), row.getAccountName(), row.getBankName(), row.getCurrencyCode())
                ).pointDates().add(row.getLatestSnapshotDate()));

        return switch (scope == null ? "accounts" : scope) {
            case "banks" -> aggregateSummaryEntriesByBank(byAccountId.values(), fromDate, toDate);
            case "total" -> aggregateSummaryEntriesTotal(byAccountId.values(), fromDate, toDate);
            default -> accountSummaryEntries(byAccountId.values(), fromDate, toDate);
        };
    }

    private List<EntrySeries> accountSummaryEntries(
            java.util.Collection<AccountSummarySeries> accounts,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        return accounts.stream()
                .map(account -> toEntrySeries(account.name(), account.currencyCode(), List.of(account), fromDate, toDate))
                .filter(entry -> entry != null)
                .toList();
    }

    private List<EntrySeries> aggregateSummaryEntriesByBank(
            java.util.Collection<AccountSummarySeries> accounts,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        Map<String, List<AccountSummarySeries>> byKey = new LinkedHashMap<>();
        accounts.forEach(account -> byKey.computeIfAbsent(account.bankName() + "|" + account.currencyCode(), ignored -> new ArrayList<>()).add(account));
        return byKey.values().stream()
                .map(group -> toEntrySeries(group.get(0).bankName(), group.get(0).currencyCode(), group, fromDate, toDate))
                .filter(entry -> entry != null)
                .toList();
    }

    private List<EntrySeries> aggregateSummaryEntriesTotal(
            java.util.Collection<AccountSummarySeries> accounts,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        String totalAccountsLabel = totalAccountsLabel();
        Map<String, List<AccountSummarySeries>> byCurrency = new LinkedHashMap<>();
        accounts.forEach(account -> byCurrency.computeIfAbsent(account.currencyCode(), ignored -> new ArrayList<>()).add(account));
        return byCurrency.entrySet().stream()
                .map(entry -> toEntrySeries(totalAccountsLabel, entry.getKey(), entry.getValue(), fromDate, toDate))
                .filter(entry -> entry != null)
                .toList();
    }

    private String totalAccountsLabel() {
        return messageSource.getMessage("reports.total.name", null, "All accounts", LocaleContextHolder.getLocale());
    }

    private EntrySeries toEntrySeries(
            String name,
            String currencyCode,
            List<AccountSummarySeries> accounts,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        BigDecimal startBalance = accounts.stream()
                .map(account -> startPeriodBalance(account.snapshots(), fromDate))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal endBalance = accounts.stream()
                .map(account -> currentPeriodDisplayedBalance(account, fromDate, toDate))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<LocalDate, BigDecimal> balanceByDate = new LinkedHashMap<>();
        java.util.Set<LocalDate> pointDates = new java.util.LinkedHashSet<>();
        BigDecimal previousDisplayedBalance = null;
        for (LocalDate date = fromDate; !date.isAfter(toDate); date = date.plusDays(1)) {
            LocalDate currentDate = date;
            BigDecimal displayedBalance = accounts.stream()
                    .map(account -> currentPeriodDisplayedBalance(account, fromDate, currentDate))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            balanceByDate.put(currentDate, displayedBalance);
            if (previousDisplayedBalance == null || displayedBalance.compareTo(previousDisplayedBalance) != 0) {
                pointDates.add(currentDate);
            }
            previousDisplayedBalance = displayedBalance;
        }

        balanceByDate.put(toDate, endBalance);
        pointDates.add(toDate);

        if (startBalance.compareTo(BigDecimal.ZERO) == 0
                && endBalance.compareTo(BigDecimal.ZERO) == 0
                && balanceByDate.values().stream().allMatch(value -> value.compareTo(BigDecimal.ZERO) == 0)) {
            return null;
        }

        return new EntrySeries(name, currencyCode, startBalance, endBalance, balanceByDate, pointDates);
    }

    private BigDecimal startPeriodBalance(List<SummarySnapshot> snapshots, LocalDate fromDate) {
        return snapshots.stream()
                .filter(snapshot -> !snapshot.date().isAfter(fromDate))
                .reduce((left, right) -> right)
                .map(SummarySnapshot::balance)
                .orElse(BigDecimal.ZERO);
    }

    private BigDecimal currentPeriodDisplayedBalance(
            AccountSummarySeries account,
            LocalDate fromDate,
            LocalDate date
    ) {
        BigDecimal baseline = startPeriodBalance(account.snapshots(), fromDate);
        return account.dailyBalances().entrySet().stream()
                .filter(entry -> !entry.getKey().isAfter(date))
                .reduce((left, right) -> right)
                .map(Map.Entry::getValue)
                .orElse(baseline);
    }

    private BigDecimal aggregate(List<PlanningReportResponse.Row> rows, java.util.function.Function<PlanningReportResponse.Row, BigDecimal> extractor) {
        List<BigDecimal> values = rows.stream().map(extractor).toList();
        if (values.stream().anyMatch(java.util.Objects::isNull)) {
            return null;
        }
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal percent(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        return numerator.multiply(BigDecimal.valueOf(100)).divide(denominator, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal balanceAt(Map<LocalDate, BigDecimal> balanceByDate, LocalDate date) {
        return balanceByDate.entrySet().stream()
                .filter(entry -> !entry.getKey().isAfter(date))
                .reduce((left, right) -> right)
                .map(Map.Entry::getValue)
                .orElse(BigDecimal.ZERO);
    }

    private String resolvePreferredCurrency(List<ReportDailyBalanceCache> rows) {
        String defaultCurrency = userSettingsService.currentUserSettings().defaultCurrency();
        return rows.stream().anyMatch(row -> defaultCurrency.equals(row.getCurrencyCode()))
                ? defaultCurrency
                : rows.get(0).getCurrencyCode();
    }

    private void ensureCurrentOwnerCache() {
        reportCacheRefreshService.ensureOwnerCacheReady(currentUserService.currentUserId(), LocalDate.now(clock));
    }

    private LocalDate resolvePeriodStart(LocalDate today, int billingMonthStartDay) {
        int normalizedStartDay = Math.max(1, Math.min(31, billingMonthStartDay));
        LocalDate currentMonthStart = today.withDayOfMonth(Math.min(normalizedStartDay, today.lengthOfMonth()));
        if (!today.isBefore(currentMonthStart)) {
            return currentMonthStart;
        }

        LocalDate previousMonth = today.minusMonths(1);
        return previousMonth.withDayOfMonth(Math.min(normalizedStartDay, previousMonth.lengthOfMonth()));
    }

    private String resolveStep(LocalDate fromDate, LocalDate toDate) {
        long days = ChronoUnit.DAYS.between(fromDate, toDate) + 1L;
        if (days <= 31) {
            return "day";
        }
        if (days <= 92) {
            return "week";
        }
        return "month";
    }

    private List<LocalDate> buildCheckpoints(LocalDate fromDate, LocalDate toDate, String step) {
        List<LocalDate> checkpoints = new ArrayList<>();
        checkpoints.add(fromDate);
        LocalDate current = fromDate;
        while (current.isBefore(toDate)) {
            current = switch (step) {
                case "week" -> current.plusWeeks(1);
                case "month" -> current.plusMonths(1);
                default -> current.plusDays(1);
            };
            if (current.isBefore(toDate)) {
                checkpoints.add(current);
            }
        }
        if (!checkpoints.get(checkpoints.size() - 1).equals(toDate)) {
            checkpoints.add(toDate);
        }
        return checkpoints;
    }

    private List<SnapshotPanelAmountResponse> sumByCurrency(List<ReportDailyBalanceCache> rows) {
        return rows.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        ReportDailyBalanceCache::getCurrencyCode,
                        LinkedHashMap::new,
                        java.util.stream.Collectors.mapping(ReportDailyBalanceCache::getBalance, java.util.stream.Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))
                ))
                .entrySet().stream()
                .map(entry -> new SnapshotPanelAmountResponse(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<SnapshotPanelAmountResponse> subtractByCurrency(
            List<SnapshotPanelAmountResponse> current,
            List<SnapshotPanelAmountResponse> previous
    ) {
        Map<String, BigDecimal> totals = new LinkedHashMap<>();
        current.forEach(amount -> totals.put(amount.currencyCode(), amount.amount()));
        previous.forEach(amount -> totals.merge(amount.currencyCode(), amount.amount().negate(), BigDecimal::add));
        return totals.entrySet().stream()
                .map(entry -> new SnapshotPanelAmountResponse(entry.getKey(), entry.getValue()))
                .toList();
    }

    private BigDecimal calculateMonthlyChangePercent(
            List<SnapshotPanelAmountResponse> current,
            List<SnapshotPanelAmountResponse> previous
    ) {
        if (current.size() != 1 || previous.size() != 1) {
            return null;
        }
        SnapshotPanelAmountResponse currentValue = current.get(0);
        SnapshotPanelAmountResponse previousValue = previous.get(0);
        if (!currentValue.currencyCode().equals(previousValue.currencyCode()) || previousValue.amount().compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        return currentValue.amount()
                .subtract(previousValue.amount())
                .multiply(BigDecimal.valueOf(100))
                .divide(previousValue.amount(), 1, RoundingMode.HALF_UP);
    }

    private String key(UUID accountId, String currencyCode) {
        return accountId + "|" + currencyCode;
    }

    private record EntryMeta(String name, String currencyCode) {
    }

    private record EntrySeries(
            String name,
            String currencyCode,
            BigDecimal startBalance,
            BigDecimal endBalance,
            Map<LocalDate, BigDecimal> balanceByDate,
            java.util.Set<LocalDate> pointDates
    ) {
    }

    private record PlannedBalance(UUID accountId, String accountName, String bankName, String currencyCode, BigDecimal balance) {
    }

    private record SummarySnapshot(LocalDate date, BigDecimal balance) {
    }

    private record AccountSummarySeries(
            UUID accountId,
            String name,
            String bankName,
            String currencyCode,
            List<SummarySnapshot> snapshots,
            Map<LocalDate, BigDecimal> dailyBalances,
            java.util.Set<LocalDate> pointDates
    ) {
        private AccountSummarySeries(UUID accountId, String name, String bankName, String currencyCode) {
            this(accountId, name, bankName, currencyCode, new ArrayList<>(), new LinkedHashMap<>(), new java.util.LinkedHashSet<>());
        }
    }
}
