package com.moneysnapshot.savings;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.snapshot.AccountSnapshot;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import com.moneysnapshot.savings.web.GenerateSavingsForecastRequest;
import com.moneysnapshot.savings.web.SavingsForecastEntryResponse;
import com.moneysnapshot.savings.web.SavingsForecastRunResponse;
import com.moneysnapshot.savings.web.SavingsForecastSummaryResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SavingsForecastServiceTest {

    private final SavingsForecastRunRepository runRepository = mock(SavingsForecastRunRepository.class);
    private final SavingsForecastEntryRepository entryRepository = mock(SavingsForecastEntryRepository.class);
    private final SavingsForecastMonthValueRepository monthValueRepository = mock(SavingsForecastMonthValueRepository.class);
    private final SavingsForecastMonthSummaryRepository monthSummaryRepository = mock(SavingsForecastMonthSummaryRepository.class);
    private final AccountRepository accountRepository = mock(AccountRepository.class);
    private final AccountSnapshotRepository snapshotRepository = mock(AccountSnapshotRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);

    private final SavingsForecastService service = new SavingsForecastService(
            runRepository,
            entryRepository,
            monthValueRepository,
            monthSummaryRepository,
            accountRepository,
            snapshotRepository,
            currentUserService
    );

    @Test
    void generateForecastRejectsUnsupportedDuration() {
        InvalidSavingsForecastRequestException exception = assertThrows(
                InvalidSavingsForecastRequestException.class,
                () -> service.generateForecast(new GenerateSavingsForecastRequest(LocalDate.of(2026, 1, 1), 7))
        );

        assertEquals("Unsupported forecast duration.", exception.getMessage());
        verify(runRepository, never()).save(any());
        verify(entryRepository, never()).saveAll(anyList());
    }

    @Test
    void generateForecastBuildsMonthlyBalancesAndCurrencySummaries() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        LocalDate startDate = LocalDate.of(2026, 1, 1);
        SavingsForecastRun savedRun = new SavingsForecastRun(owner, startDate, 6);
        ReflectionTestUtils.setField(savedRun, "id", UUID.randomUUID());

        Account plnAccount = account("Main account", "Bank A", "PLN", new BigDecimal("100.00"));
        Account usdAccount = account("USD reserve", "Bank B", "USD", null);
        AccountSnapshot plnSnapshot = new AccountSnapshot(
                plnAccount,
                owner,
                LocalDate.of(2025, 12, 31),
                new BigDecimal("1000.00"),
                null,
                null
        );

        List<SavingsForecastMonthValue> savedMonthValues = new ArrayList<>();
        List<SavingsForecastMonthSummary> savedMonthSummaries = new ArrayList<>();

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(currentUserService.currentUser()).thenReturn(owner);
        when(accountRepository.findAllByOwnerIdWithBankOrderByName(ownerId)).thenReturn(List.of(plnAccount, usdAccount));
        when(snapshotRepository.findLatestByOwnerIdBeforeOrOnDateWithAccountOrderByAccountName(ownerId, startDate))
                .thenReturn(List.of(plnSnapshot));
        when(runRepository.save(any(SavingsForecastRun.class))).thenReturn(savedRun);
        when(entryRepository.saveAll(anyList())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            List<SavingsForecastEntry> entries = invocation.getArgument(0);
            int index = 1;
            for (SavingsForecastEntry entry : entries) {
                ReflectionTestUtils.setField(entry, "id", UUID.fromString(String.format("00000000-0000-0000-0000-%012d", index++)));
            }
            return entries;
        });
        when(monthValueRepository.saveAll(anyList())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            List<SavingsForecastMonthValue> values = invocation.getArgument(0);
            savedMonthValues.clear();
            savedMonthValues.addAll(values);
            return values;
        });
        when(monthSummaryRepository.saveAll(anyList())).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            List<SavingsForecastMonthSummary> summaries = invocation.getArgument(0);
            savedMonthSummaries.clear();
            savedMonthSummaries.addAll(summaries);
            return summaries;
        });
        when(monthValueRepository.findAllByRunIdOrderByForecastMonthAndAccountName(savedRun.getId())).thenAnswer(invocation -> savedMonthValues);
        when(monthSummaryRepository.findAllByRunIdOrderByForecastMonthAndCurrencyCode(savedRun.getId())).thenAnswer(invocation -> savedMonthSummaries);

        SavingsForecastRunResponse response = service.generateForecast(new GenerateSavingsForecastRequest(startDate, 6));

        assertEquals(6, response.forecastMonths().size());
        assertEquals(2, response.entries().size());
        assertEquals(12, response.summaries().size());
        assertEquals(12, savedMonthValues.size());

        SavingsForecastEntryResponse firstEntry = response.entries().get(0);
        SavingsForecastEntryResponse secondEntry = response.entries().get(1);

        assertEquals("Main account", firstEntry.accountName());
        assertBigDecimalEquals("1000.00", firstEntry.startingBalance());
        assertBigDecimalEquals("100.00", firstEntry.forecastedMonthlyContribution());
        assertBigDecimalEquals("1600.00", firstEntry.projectedBalance());
        assertBigDecimalEquals("1100.00", firstEntry.monthlyBalances().get(0).balance());
        assertBigDecimalEquals("1600.00", firstEntry.monthlyBalances().get(5).balance());

        assertEquals("USD reserve", secondEntry.accountName());
        assertBigDecimalEquals("0", secondEntry.startingBalance());
        assertBigDecimalEquals("0", secondEntry.forecastedMonthlyContribution());
        assertBigDecimalEquals("0", secondEntry.projectedBalance());
        assertBigDecimalEquals("0", secondEntry.monthlyBalances().get(0).balance());
        assertBigDecimalEquals("0", secondEntry.monthlyBalances().get(5).balance());

        assertSummaryTotal(response.summaries(), LocalDate.of(2026, 1, 1), "PLN", new BigDecimal("1100.00"));
        assertSummaryTotal(response.summaries(), LocalDate.of(2026, 1, 1), "USD", new BigDecimal("0"));
    }

    private Account account(String accountName, String bankName, String currencyCode, BigDecimal monthlyContribution) {
        Bank bank = mock(Bank.class);
        when(bank.getName()).thenReturn(bankName);

        Account account = mock(Account.class);
        when(account.getId()).thenReturn(UUID.randomUUID());
        when(account.getName()).thenReturn(accountName);
        when(account.getBank()).thenReturn(bank);
        when(account.getCurrencyCode()).thenReturn(currencyCode);
        when(account.getForecastedMonthlyContribution()).thenReturn(monthlyContribution);
        return account;
    }

    private void assertSummaryTotal(
            List<SavingsForecastSummaryResponse> summaries,
            LocalDate month,
            String currencyCode,
            BigDecimal expectedTotal
    ) {
        SavingsForecastSummaryResponse summary = summaries.stream()
                .filter(item -> month.equals(item.forecastMonth()) && currencyCode.equals(item.currencyCode()))
                .findFirst()
                .orElseThrow();

        assertBigDecimalEquals(expectedTotal.toPlainString(), summary.totalBalance());
    }

    private void assertBigDecimalEquals(String expected, BigDecimal actual) {
        assertTrue(new BigDecimal(expected).compareTo(actual) == 0);
    }
}
