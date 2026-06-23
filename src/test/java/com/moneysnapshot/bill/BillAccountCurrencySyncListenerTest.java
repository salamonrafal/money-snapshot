package com.moneysnapshot.bill;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountCurrencyChangedEvent;
import com.moneysnapshot.account.AccountStatus;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.counterparty.Counterparty;
import com.moneysnapshot.security.AppUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class BillAccountCurrencySyncListenerTest {

    @Mock
    private BillRepository billRepository;

    @Mock
    private BillScheduleEntryRepository billScheduleEntryRepository;

    @Test
    void onAccountCurrencyChangedUpdatesBillsAndScheduleEntries() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Main account", "main-account", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        Counterparty counterparty = new Counterparty(owner, "Orange", "orange", "12121212121212121212121212", null, null);
        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet",
                "internet",
                "PLN",
                new BigDecimal("100.00"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        UUID accountId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(account, "id", accountId);
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleEntry entry = new BillScheduleEntry(owner, bill, 1, LocalDate.of(2026, 7, 10), new BigDecimal("100.00"), "PLN");

        BillAccountCurrencySyncListener listener = new BillAccountCurrencySyncListener(billRepository, billScheduleEntryRepository);

        when(billRepository.findAllByAccountId(accountId)).thenReturn(List.of(bill));
        when(billScheduleEntryRepository.findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(billId)).thenReturn(List.of(entry));

        listener.onAccountCurrencyChanged(new AccountCurrencyChangedEvent(accountId, "EUR"));

        assertThat(bill.getCurrencyCode()).isEqualTo("EUR");
        assertThat(entry.getCurrencyCode()).isEqualTo("EUR");
        verify(billScheduleEntryRepository).flush();
        verify(billRepository).flush();
    }
}
