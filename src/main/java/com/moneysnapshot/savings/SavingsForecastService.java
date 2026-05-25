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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class SavingsForecastService {

    private static final Set<Integer> ALLOWED_DURATIONS = Set.of(6, 12, 24, 60, 120);

    private final SavingsForecastRunRepository runRepository;
    private final SavingsForecastEntryRepository entryRepository;
    private final SavingsForecastMonthValueRepository monthValueRepository;
    private final SavingsForecastMonthSummaryRepository monthSummaryRepository;
    private final AccountRepository accountRepository;
    private final AccountSnapshotRepository snapshotRepository;
    private final CurrentUserService currentUserService;

    public SavingsForecastService(
            SavingsForecastRunRepository runRepository,
            SavingsForecastEntryRepository entryRepository,
            SavingsForecastMonthValueRepository monthValueRepository,
            SavingsForecastMonthSummaryRepository monthSummaryRepository,
            AccountRepository accountRepository,
            AccountSnapshotRepository snapshotRepository,
            CurrentUserService currentUserService
    ) {
        this.runRepository = runRepository;
        this.entryRepository = entryRepository;
        this.monthValueRepository = monthValueRepository;
        this.monthSummaryRepository = monthSummaryRepository;
        this.accountRepository = accountRepository;
        this.snapshotRepository = snapshotRepository;
        this.currentUserService = currentUserService;
    }

    public Optional<SavingsForecastRunResponse> latestForecast() {
        UUID ownerId = currentUserService.currentUserId();
        return runRepository.findFirstByOwnerIdOrderByGeneratedAtDesc(ownerId)
                .map(this::toResponse);
    }

    @Transactional
    public void deleteAllForecasts() {
        runRepository.deleteByOwnerId(currentUserService.currentUserId());
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
                .collect(java.util.stream.Collectors.toMap(
                        snapshot -> snapshot.getAccount().getId(),
                        Function.identity()
                ));

        SavingsForecastRun run = runRepository.save(new SavingsForecastRun(
                owner,
                request.forecastStartDate(),
                request.durationMonths()
        ));

        List<SavingsForecastEntry> entries = accounts.stream()
                .map(account -> createEntry(run, account, latestSnapshotsByAccountId.get(account.getId()), request.durationMonths()))
                .toList();

        List<SavingsForecastEntry> savedEntries = entryRepository.saveAll(entries);
        List<LocalDate> forecastMonths = buildForecastMonths(run.getForecastStartDate(), run.getDurationMonths());
        List<SavingsForecastMonthValue> savedMonthValues = monthValueRepository.saveAll(buildMonthValues(savedEntries, forecastMonths));
        List<SavingsForecastMonthSummary> savedMonthSummaries = monthSummaryRepository.saveAll(
                buildMonthSummaries(run, savedEntries, forecastMonths)
        );
        return toResponse(run, savedEntries, savedMonthValues, savedMonthSummaries);
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
        List<SavingsForecastMonthSummary> monthSummaries = monthSummaryRepository.findAllByRunIdOrderByForecastMonthAndCurrencyCode(run.getId());
        return toResponse(run, entries, monthValues, monthSummaries);
    }

    private SavingsForecastRunResponse toResponse(
            SavingsForecastRun run,
            List<SavingsForecastEntry> entries,
            List<SavingsForecastMonthValue> monthValues,
            List<SavingsForecastMonthSummary> monthSummaries
    ) {
        List<LocalDate> forecastMonths = buildForecastMonths(run.getForecastStartDate(), run.getDurationMonths());
        Map<UUID, List<SavingsForecastMonthValueResponse>> monthlyValuesByEntryId = monthValues
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

        return new SavingsForecastRunResponse(
                run.getId(),
                run.getForecastStartDate(),
                run.getForecastStartDate().plusMonths(run.getDurationMonths()).minusDays(1),
                run.getDurationMonths(),
                run.getGeneratedAt(),
                forecastMonths,
                monthSummaries.stream()
                        .map(SavingsForecastSummaryResponse::from)
                        .toList(),
                entries.stream()
                        .map(entry -> SavingsForecastEntryResponse.from(
                                entry,
                                monthlyValuesByEntryId.getOrDefault(entry.getId(), List.of())
                        ))
                        .toList()
        );
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

    private List<SavingsForecastMonthValue> buildMonthValues(
            List<SavingsForecastEntry> entries,
            List<LocalDate> forecastMonths
    ) {
        List<SavingsForecastMonthValue> values = new ArrayList<>(entries.size() * forecastMonths.size());
        for (SavingsForecastEntry entry : entries) {
            for (MonthBalance monthBalance : buildMonthlyBalances(entry, forecastMonths)) {
                values.add(new SavingsForecastMonthValue(entry, monthBalance.forecastMonth(), monthBalance.balance()));
            }
        }
        return values;
    }

    private List<SavingsForecastMonthSummary> buildMonthSummaries(
            SavingsForecastRun run,
            List<SavingsForecastEntry> entries,
            List<LocalDate> forecastMonths
    ) {
        Map<MonthCurrencyKey, BigDecimal> totalsByMonthAndCurrency = new java.util.LinkedHashMap<>();

        for (SavingsForecastEntry entry : entries) {
            List<MonthBalance> values = buildMonthlyBalances(entry, forecastMonths);
            for (MonthBalance value : values) {
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
