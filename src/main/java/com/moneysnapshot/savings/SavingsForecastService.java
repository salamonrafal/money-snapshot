package com.moneysnapshot.savings;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.snapshot.AccountSnapshot;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.savings.web.GenerateSavingsForecastRequest;
import com.moneysnapshot.savings.web.SavingsForecastEntryResponse;
import com.moneysnapshot.savings.web.SavingsForecastMonthValueResponse;
import com.moneysnapshot.savings.web.SavingsForecastRunResponse;
import com.moneysnapshot.savings.web.SavingsForecastSummaryResponse;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class SavingsForecastService {

    private static final Set<Integer> ALLOWED_DURATIONS = Set.of(6, 12, 24, 60, 120);
    private static final Comparator<SavingsForecastMonthSummary> MONTH_SUMMARY_ORDER =
            Comparator.comparing(SavingsForecastMonthSummary::getForecastMonth)
                    .thenComparing(SavingsForecastMonthSummary::getCurrencyCode);

    private final SavingsForecastRunRepository runRepository;
    private final SavingsForecastEntryRepository entryRepository;
    private final SavingsForecastMonthValueRepository monthValueRepository;
    private final SavingsForecastMonthSummaryRepository monthSummaryRepository;
    private final AccountRepository accountRepository;
    private final AccountSnapshotRepository snapshotRepository;
    private final CurrentUserService currentUserService;
    private final ApplicationEventPublisher eventPublisher;

    public SavingsForecastService(
            SavingsForecastRunRepository runRepository,
            SavingsForecastEntryRepository entryRepository,
            SavingsForecastMonthValueRepository monthValueRepository,
            SavingsForecastMonthSummaryRepository monthSummaryRepository,
            AccountRepository accountRepository,
            AccountSnapshotRepository snapshotRepository,
            CurrentUserService currentUserService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.runRepository = runRepository;
        this.entryRepository = entryRepository;
        this.monthValueRepository = monthValueRepository;
        this.monthSummaryRepository = monthSummaryRepository;
        this.accountRepository = accountRepository;
        this.snapshotRepository = snapshotRepository;
        this.currentUserService = currentUserService;
        this.eventPublisher = eventPublisher;
    }

    public Optional<SavingsForecastRunResponse> latestForecast() {
        UUID ownerId = currentUserService.currentUserId();
        return runRepository.findFirstByOwnerIdOrderByGeneratedAtDesc(ownerId)
                .map(this::toResponse);
    }

    @Transactional
    public void deleteAllForecasts() {
        UUID ownerId = currentUserService.currentUserId();
        runRepository.deleteByOwnerId(ownerId);
        eventPublisher.publishEvent(new SavingsForecastChangedEvent(ownerId));
    }

    @Transactional
    public SavingsForecastRunResponse generateForecast(GenerateSavingsForecastRequest request) {
        validateRequest(request);

        UUID ownerId = currentUserService.currentUserId();
        AppUser owner = currentUserService.currentUser();
        List<Account> accounts = accountRepository.findAllByOwnerIdWithBankOrderByName(ownerId);
        Map<UUID, AccountSnapshot> latestSnapshotsByAccountId = snapshotRepository
                .findLatestByOwnerIdBeforeOrOnDateWithAccountOrderByAccountName(ownerId, request.forecastStartDate())
                .stream()
                .collect(Collectors.toMap(
                        snapshot -> snapshot.getAccount().getId(),
                        Function.identity()
                ));

        SavingsForecastRun run = runRepository.save(new SavingsForecastRun(
                owner,
                request.forecastStartDate(),
                request.durationMonths()
        ));

        List<SavingsForecastEntry> entries = accounts.stream()
                .filter(account -> hasVisibleForecast(account.getForecastedMonthlyContribution()))
                .map(account -> createEntry(run, account, latestSnapshotsByAccountId.get(account.getId()), request.durationMonths()))
                .toList();

        List<SavingsForecastEntry> savedEntries = entryRepository.saveAll(entries);
        List<LocalDate> forecastMonths = buildForecastMonths(run.getForecastStartDate(), run.getDurationMonths());
        Map<UUID, List<MonthBalance>> monthlyBalancesByEntryId = buildMonthlyBalancesByEntryId(savedEntries, forecastMonths);
        List<SavingsForecastMonthValue> savedMonthValues = monthValueRepository.saveAll(
                buildMonthValues(savedEntries, monthlyBalancesByEntryId)
        );
        monthSummaryRepository.saveAll(
                buildMonthSummaries(run, savedEntries, monthlyBalancesByEntryId)
        );
        eventPublisher.publishEvent(new SavingsForecastChangedEvent(ownerId));
        return toResponse(run, savedEntries, savedMonthValues);
    }

    private void validateRequest(GenerateSavingsForecastRequest request) {
        if (request.forecastStartDate() == null) {
            throw new InvalidSavingsForecastRequestException("Forecast start date is required.");
        }

        if (request.durationMonths() == null) {
            throw new InvalidSavingsForecastRequestException("Forecast duration is required.");
        }

        if (!ALLOWED_DURATIONS.contains(request.durationMonths())) {
            throw new InvalidSavingsForecastRequestException("Unsupported forecast duration.");
        }
    }

    private SavingsForecastEntry createEntry(
            SavingsForecastRun run,
            Account account,
            AccountSnapshot latestSnapshot,
            int durationMonths
    ) {
        BigDecimal startingBalance = latestSnapshot == null ? BigDecimal.ZERO : latestSnapshot.getBalance();
        BigDecimal monthlyContribution = account.getForecastedMonthlyContribution() == null
                ? BigDecimal.ZERO
                : account.getForecastedMonthlyContribution();
        BigDecimal projectedBalance = startingBalance.add(monthlyContribution.multiply(BigDecimal.valueOf(durationMonths)));

        return new SavingsForecastEntry(
                run,
                account,
                startingBalance,
                monthlyContribution,
                projectedBalance,
                latestSnapshot == null ? null : latestSnapshot.getSnapshotDate()
        );
    }

    private SavingsForecastRunResponse toResponse(SavingsForecastRun run) {
        List<SavingsForecastEntry> entries = entryRepository.findAllByRunIdWithAccountOrderByAccountName(run.getId());
        List<SavingsForecastMonthValue> monthValues = monthValueRepository.findAllByRunIdOrderByForecastMonthAndAccountName(run.getId());
        return toResponse(run, entries, monthValues);
    }

    private SavingsForecastRunResponse toResponse(
            SavingsForecastRun run,
            List<SavingsForecastEntry> entries,
            List<SavingsForecastMonthValue> monthValues
    ) {
        List<SavingsForecastEntry> visibleEntries = entries.stream()
                .filter(entry -> hasVisibleForecast(entry.getForecastedMonthlyContribution()))
                .toList();
        Set<UUID> visibleEntryIds = visibleEntries.stream()
                .map(SavingsForecastEntry::getId)
                .collect(Collectors.toSet());
        List<SavingsForecastMonthValue> visibleMonthValues = monthValues.stream()
                .filter(monthValue -> visibleEntryIds.contains(monthValue.getEntry().getId()))
                .toList();
        List<LocalDate> forecastMonths = buildForecastMonths(run.getForecastStartDate(), run.getDurationMonths());
        Map<UUID, List<SavingsForecastMonthValueResponse>> monthlyValuesByEntryId = visibleMonthValues
                .stream()
                .collect(Collectors.groupingBy(
                        monthValue -> monthValue.getEntry().getId(),
                        java.util.LinkedHashMap::new,
                        Collectors.mapping(
                                monthValue -> toMonthValueResponse(new MonthBalance(
                                        monthValue.getForecastMonth(),
                                        monthValue.getBalance()
                                )),
                                Collectors.toList()
                        )
                ));
        Map<UUID, List<MonthBalance>> monthlyBalancesByEntryId = visibleMonthValues
                .stream()
                .collect(Collectors.groupingBy(
                        monthValue -> monthValue.getEntry().getId(),
                        java.util.LinkedHashMap::new,
                        Collectors.mapping(
                                monthValue -> new MonthBalance(monthValue.getForecastMonth(), monthValue.getBalance()),
                                Collectors.toList()
                        )
                ));
        List<SavingsForecastSummaryResponse> visibleSummaries = buildMonthSummaries(run, visibleEntries, monthlyBalancesByEntryId)
                .stream()
                .map(SavingsForecastSummaryResponse::from)
                .toList();

        return new SavingsForecastRunResponse(
                run.getId(),
                run.getForecastStartDate(),
                run.getForecastStartDate().plusMonths(run.getDurationMonths()).minusDays(1),
                run.getDurationMonths(),
                run.getGeneratedAt(),
                forecastMonths,
                visibleSummaries,
                visibleEntries.stream()
                        .map(entry -> SavingsForecastEntryResponse.from(
                                entry,
                                monthlyValuesByEntryId.getOrDefault(entry.getId(), List.of())
                        ))
                        .toList()
        );
    }

    private boolean hasVisibleForecast(BigDecimal monthlyContribution) {
        return monthlyContribution != null && monthlyContribution.compareTo(BigDecimal.ZERO) > 0;
    }

    private List<LocalDate> buildForecastMonths(LocalDate forecastStartDate, int durationMonths) {
        List<LocalDate> months = new ArrayList<>(durationMonths);
        for (int monthIndex = 0; monthIndex < durationMonths; monthIndex++) {
            months.add(forecastStartDate.plusMonths(monthIndex));
        }
        return months;
    }

    private List<MonthBalance> buildMonthlyBalances(
            SavingsForecastEntry entry,
            List<LocalDate> forecastMonths
    ) {
        List<MonthBalance> values = new ArrayList<>(forecastMonths.size());
        BigDecimal startingBalance = entry.getStartingBalance();
        BigDecimal monthlyContribution = entry.getForecastedMonthlyContribution();

        for (int monthIndex = 0; monthIndex < forecastMonths.size(); monthIndex++) {
            BigDecimal monthBalance = startingBalance.add(
                    monthlyContribution.multiply(BigDecimal.valueOf(monthIndex + 1L))
            );
            values.add(new MonthBalance(forecastMonths.get(monthIndex), monthBalance));
        }

        return values;
    }

    private Map<UUID, List<MonthBalance>> buildMonthlyBalancesByEntryId(
            List<SavingsForecastEntry> entries,
            List<LocalDate> forecastMonths
    ) {
        Map<UUID, List<MonthBalance>> monthlyBalancesByEntryId = new java.util.LinkedHashMap<>();
        for (SavingsForecastEntry entry : entries) {
            monthlyBalancesByEntryId.put(entry.getId(), buildMonthlyBalances(entry, forecastMonths));
        }
        return monthlyBalancesByEntryId;
    }

    private List<SavingsForecastMonthValue> buildMonthValues(
            List<SavingsForecastEntry> entries,
            Map<UUID, List<MonthBalance>> monthlyBalancesByEntryId
    ) {
        int totalMonthValues = monthlyBalancesByEntryId.values().stream()
                .mapToInt(List::size)
                .sum();
        List<SavingsForecastMonthValue> values = new ArrayList<>(totalMonthValues);
        for (SavingsForecastEntry entry : entries) {
            for (MonthBalance monthBalance : monthlyBalancesByEntryId.getOrDefault(entry.getId(), List.of())) {
                values.add(new SavingsForecastMonthValue(entry, monthBalance.forecastMonth(), monthBalance.balance()));
            }
        }
        return values;
    }

    private List<SavingsForecastMonthSummary> buildMonthSummaries(
            SavingsForecastRun run,
            List<SavingsForecastEntry> entries,
            Map<UUID, List<MonthBalance>> monthlyBalancesByEntryId
    ) {
        Map<MonthCurrencyKey, BigDecimal> totalsByMonthAndCurrency = new java.util.LinkedHashMap<>();

        for (SavingsForecastEntry entry : entries) {
            for (MonthBalance value : monthlyBalancesByEntryId.getOrDefault(entry.getId(), List.of())) {
                MonthCurrencyKey key = new MonthCurrencyKey(
                        value.forecastMonth(),
                        entry.getAccount().getCurrencyCode()
                );
                totalsByMonthAndCurrency.merge(key, value.balance(), BigDecimal::add);
            }
        }

        return totalsByMonthAndCurrency.entrySet().stream()
                .map(totalEntry -> new SavingsForecastMonthSummary(
                        run,
                        totalEntry.getKey().forecastMonth(),
                        totalEntry.getKey().currencyCode(),
                        totalEntry.getValue()
                ))
                .sorted(MONTH_SUMMARY_ORDER)
                .toList();
    }

    private SavingsForecastMonthValueResponse toMonthValueResponse(MonthBalance monthBalance) {
        return new SavingsForecastMonthValueResponse(monthBalance.forecastMonth(), monthBalance.balance());
    }

    private record MonthCurrencyKey(LocalDate forecastMonth, String currencyCode) {
    }

    private record MonthBalance(LocalDate forecastMonth, BigDecimal balance) {
    }
}
