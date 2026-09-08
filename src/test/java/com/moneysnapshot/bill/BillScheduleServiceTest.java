package com.moneysnapshot.bill;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountStatus;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class BillScheduleServiceTest {
    private static final LocalDate PERIOD_START = LocalDate.of(2026, 8, 11);
    private static final LocalDate PERIOD_END = LocalDate.of(2026, 9, 10);

    @Mock
    private BillRepository billRepository;

    @Mock
    private BillScheduleEntryRepository billScheduleEntryRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Test
    void upcomingPaymentsUseCurrentOwnerAndIncludeBillDetails() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        Bill bill = org.mockito.Mockito.mock(Bill.class);
        Account account = org.mockito.Mockito.mock(Account.class);
        var counterparty = org.mockito.Mockito.mock(com.moneysnapshot.counterparty.Counterparty.class);
        when(bill.getId()).thenReturn(billId);
        when(bill.getStatus()).thenReturn(BillStatus.ACTIVE);
        when(bill.getName()).thenReturn("Internet");
        when(bill.getAccount()).thenReturn(account);
        when(bill.getCounterparty()).thenReturn(counterparty);
        when(account.getName()).thenReturn("Personal PLN");
        when(counterparty.getName()).thenReturn("Provider");
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(ownerId)).thenReturn(List.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(1L);
        var entry = new BillScheduleEntry(null, bill, 1, LocalDate.of(2026, 9, 10), new BigDecimal("100.00"), "PLN");
        when(billScheduleEntryRepository.findPendingByOwnerId(ownerId, PERIOD_START, PERIOD_END)).thenReturn(List.of(entry));

        var result = new BillScheduleService(billRepository, billScheduleEntryRepository, currentUserService)
                .listUpcomingPayments(PERIOD_START, PERIOD_END);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).billId()).isEqualTo(billId);
        assertThat(result.get(0).billName()).isEqualTo("Internet");
        assertThat(result.get(0).accountName()).isEqualTo("Personal PLN");
        assertThat(result.get(0).counterpartyName()).isEqualTo("Provider");
        assertThat(result.get(0).payment().amount()).isEqualByComparingTo("100.00");
        assertThat(result.get(0).payment().currencyCode()).isEqualTo("PLN");
        verify(billScheduleEntryRepository).findPendingByOwnerId(ownerId, PERIOD_START, PERIOD_END);
        verify(billScheduleEntryRepository, never()).saveAll(any());
    }

    @Test
    void upcomingPaymentsDoNotGenerateSchedulesForInactiveBills() {
        UUID ownerId = UUID.randomUUID();
        Bill suspended = org.mockito.Mockito.mock(Bill.class);
        Bill completed = org.mockito.Mockito.mock(Bill.class);
        when(suspended.getStatus()).thenReturn(BillStatus.SUSPENDED);
        when(completed.getStatus()).thenReturn(BillStatus.COMPLETED);
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(ownerId)).thenReturn(List.of(suspended, completed));
        when(billScheduleEntryRepository.findPendingByOwnerId(ownerId, PERIOD_START, PERIOD_END)).thenReturn(List.of());

        assertThat(new BillScheduleService(billRepository, billScheduleEntryRepository, currentUserService)
                .listUpcomingPayments(PERIOD_START, PERIOD_END)).isEmpty();

        verify(billScheduleEntryRepository, never()).countByBillId(any());
        verify(billScheduleEntryRepository, never()).saveAll(any());
    }

    @Test
    void upcomingPaymentsGenerateMissingOpenEndedEntriesFromCurrentPeriodStart() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                5,
                LocalDate.of(2025, 1, 15),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleEntry lastEntry = new BillScheduleEntry(
                owner,
                bill,
                8,
                LocalDate.of(2026, 8, 5),
                new BigDecimal("189.99"),
                "PLN"
        );

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-09-08T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(ownerId)).thenReturn(List.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(1L);
        when(billScheduleEntryRepository.existsByBillIdAndOwnerIdAndDueDateGreaterThanEqual(
                billId,
                ownerId,
                PERIOD_END
        )).thenReturn(false);
        when(billScheduleEntryRepository.findFirstByBillIdAndOwnerIdOrderByDueDateDescInstallmentNumberDesc(billId, ownerId))
                .thenReturn(Optional.of(lastEntry));
        when(billScheduleEntryRepository.findPendingByOwnerId(ownerId, PERIOD_START, PERIOD_END)).thenReturn(List.of());

        service.listUpcomingPayments(PERIOD_START, PERIOD_END);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries).hasSize(12);
        assertThat(entries.get(0).getInstallmentNumber()).isEqualTo(9);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2026, 9, 5));
        assertThat(entries.get(11).getDueDate()).isEqualTo(LocalDate.of(2027, 8, 5));
    }

    @Test
    void upcomingPaymentsGenerateOpenEndedEntriesThroughCurrentPeriodEnd() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                31,
                LocalDate.of(2025, 1, 31),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleEntry lastEntry = new BillScheduleEntry(
                owner,
                bill,
                12,
                LocalDate.of(2026, 1, 31),
                new BigDecimal("189.99"),
                "PLN"
        );

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-01-31T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        LocalDate periodStart = LocalDate.of(2026, 1, 31);
        LocalDate periodEnd = LocalDate.of(2026, 2, 28);
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(ownerId)).thenReturn(List.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(1L);
        when(billScheduleEntryRepository.existsByBillIdAndOwnerIdAndDueDateGreaterThanEqual(
                billId,
                ownerId,
                periodEnd
        )).thenReturn(false);
        when(billScheduleEntryRepository.findFirstByBillIdAndOwnerIdOrderByDueDateDescInstallmentNumberDesc(billId, ownerId))
                .thenReturn(Optional.of(lastEntry));
        when(billScheduleEntryRepository.findPendingByOwnerId(ownerId, periodStart, periodEnd)).thenReturn(List.of());

        service.listUpcomingPayments(periodStart, periodEnd);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries).hasSize(12);
        assertThat(entries.get(0).getInstallmentNumber()).isEqualTo(13);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2026, 2, 28));
        assertThat(entries.get(11).getDueDate()).isEqualTo(LocalDate.of(2027, 1, 31));
    }

    @Test
    void regenerateScheduleCreatesTwelveUpcomingEntriesForOpenEndedBill() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2025, 1, 15),
                BillStatus.ACTIVE
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));

        service.regenerateSchedule(billId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries).hasSize(12);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2026, 7, 10));
        assertThat(entries.get(entries.size() - 1).getDueDate()).isEqualTo(LocalDate.of(2027, 6, 10));
    }

    @Test
    void regenerateScheduleDoesNotCreateFutureEntriesForCompletedBill() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2025, 1, 15),
                BillStatus.COMPLETED
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));

        service.regenerateSchedule(billId);

        verify(billScheduleEntryRepository, never()).saveAll(any());
    }

    @Test
    void listScheduleBackfillsCacheWhenEntriesAreMissing() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.INSTALLMENTS,
                null,
                3,
                5,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(0L);
        when(billScheduleEntryRepository.findVisiblePageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(0, 12)
        ))
                .thenReturn(new PageImpl<>(List.of()));

        service.listSchedule(billId, PageRequest.of(0, 12));

        verify(billScheduleEntryRepository).saveAll(any());
    }

    @Test
    void listScheduleDoesNotAppendEntriesForCompletedOpenEndedBill() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                5,
                LocalDate.of(2026, 1, 1),
                BillStatus.COMPLETED
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(0L);
        when(billScheduleEntryRepository.findVisiblePageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(0, 12)
        ))
                .thenReturn(new PageImpl<>(List.of()));

        service.listSchedule(billId, PageRequest.of(0, 12));

        verify(billScheduleEntryRepository, never()).saveAll(any());
        verify(billRepository, never()).findByIdAndOwnerIdForUpdate(billId, ownerId);
    }

    @Test
    void overdueUnpaidInstallmentsRemainVisibleInScheduleResults() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                10,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleEntry overdueUnpaidEntry = new BillScheduleEntry(
                owner,
                bill,
                1,
                LocalDate.of(2026, 6, 10),
                new BigDecimal("189.99"),
                "PLN"
        );
        BillScheduleEntry upcomingEntry = new BillScheduleEntry(
                owner,
                bill,
                2,
                LocalDate.of(2026, 7, 10),
                new BigDecimal("189.99"),
                "PLN"
        );

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(2L);
        when(billScheduleEntryRepository.findVisiblePageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(0, 12)
        ))
                .thenReturn(new PageImpl<>(List.of(overdueUnpaidEntry, upcomingEntry), PageRequest.of(0, 12), 2));

        var result = service.listSchedule(billId, PageRequest.of(0, 12));

        assertThat(result.content()).hasSize(2);
        assertThat(result.content().get(0).installmentNumber()).isEqualTo(1);
        assertThat(result.content().get(0).dueDate()).isEqualTo(LocalDate.of(2026, 6, 10));
        assertThat(result.content().get(0).paid()).isFalse();
        assertThat(result.content().get(1).installmentNumber()).isEqualTo(2);
    }

    @Test
    void listScheduleDoesNotExpandOpenEndedEntriesWhenTheFirstPageIsLarger() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                5,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(12L);
        when(billScheduleEntryRepository.findVisiblePageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(0, 50)
        ))
                .thenReturn(new PageImpl<>(List.of()));

        service.listSchedule(billId, PageRequest.of(0, 50));

        verify(billScheduleEntryRepository, never()).saveAll(any());
    }

    @Test
    void regenerateScheduleFromCurrentDateKeepsOnlyRemainingInstallmentsFromNearestUpcomingDueDate() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                10,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));

        service.regenerateScheduleFromCurrentDate(billId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries).hasSize(6);
        assertThat(entries.get(0).getInstallmentNumber()).isEqualTo(7);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2026, 7, 10));
        assertThat(entries.get(5).getInstallmentNumber()).isEqualTo(12);
        assertThat(entries.get(5).getDueDate()).isEqualTo(LocalDate.of(2026, 12, 10));
    }

    @Test
    void regenerateScheduleFromCurrentDateKeepsUntilDateInstallmentNumberingAfterPastEntries() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.UNTIL_DATE,
                LocalDate.of(2026, 12, 31),
                null,
                10,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(billId)).thenReturn(List.of());

        service.regenerateScheduleFromCurrentDate(billId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries.get(0).getInstallmentNumber()).isEqualTo(7);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2026, 7, 10));
    }

    @Test
    void regenerateScheduleFromCurrentDateKeepsOpenEndedInstallmentNumberingAfterPastEntries() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(billId)).thenReturn(List.of());

        service.regenerateScheduleFromCurrentDate(billId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries.get(0).getInstallmentNumber()).isEqualTo(7);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2026, 7, 10));
    }

    @Test
    void regenerateScheduleFromCurrentDatePreservesPaidHistoryAndDeletesOnlyUpcomingUnpaidEntries() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                10,
                LocalDate.of(2026, 1, 1),
                BillStatus.ACTIVE
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleEntry historicalPaidEntry = new BillScheduleEntry(
                owner,
                bill,
                1,
                LocalDate.of(2026, 1, 10),
                new BigDecimal("189.99"),
                "PLN"
        );
        historicalPaidEntry.setPaid(true);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(billId))
                .thenReturn(List.of(historicalPaidEntry));

        service.regenerateScheduleFromCurrentDate(billId);

        verify(billScheduleEntryRepository).deleteByBillIdAndDueDateGreaterThanEqualAndPaidFalse(billId, LocalDate.of(2026, 6, 22));
        verify(billScheduleEntryRepository, never()).deleteByBillId(billId);
    }

    @Test
    void regenerateScheduleFromCurrentDatePreservesShiftedFutureRowsByDueDateInsteadOfInstallmentNumber() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.UNTIL_DATE,
                LocalDate.of(2026, 12, 31),
                null,
                10,
                LocalDate.of(2026, 2, 1),
                BillStatus.ACTIVE
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleEntry preservedJuneEntry = new BillScheduleEntry(
                owner,
                bill,
                6,
                LocalDate.of(2026, 6, 10),
                new BigDecimal("189.99"),
                "PLN"
        );

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(billId))
                .thenReturn(List.of(preservedJuneEntry));

        service.regenerateScheduleFromCurrentDate(billId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        // Moving the effective schedule window can remap installment numbers to later months.
        // The new July row must survive even if a preserved June row used the same number before.
        assertThat(entries).extracting(BillScheduleEntry::getDueDate)
                .contains(LocalDate.of(2026, 7, 10));
        assertThat(entries).extracting(BillScheduleEntry::getInstallmentNumber)
                .contains(6);
    }

    @Test
    void regenerateScheduleGeneratesAllSixHundredInstallmentsWhenFirstMonthIsSkipped() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.INSTALLMENTS,
                null,
                600,
                1,
                LocalDate.of(2026, 1, 31),
                BillStatus.ACTIVE
        );
        UUID billId = UUID.randomUUID();
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-01-15T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(billRepository.findByIdWithAccountAndCounterparty(billId)).thenReturn(Optional.of(bill));

        service.regenerateSchedule(billId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries).hasSize(600);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(entries.get(599).getDueDate()).isEqualTo(LocalDate.of(2076, 1, 1));
    }

    @Test
    void listScheduleDoesNotExpandOpenEndedScheduleOnFirstPageWhenRowsRemain() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2025, 1, 15),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(12L);
        when(billScheduleEntryRepository.findVisiblePageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(0, 12)
        ))
                .thenReturn(new PageImpl<>(List.of()));

        service.listSchedule(billId, PageRequest.of(0, 12));

        verify(billScheduleEntryRepository, never()).deleteByBillId(billId);
        verify(billScheduleEntryRepository, never()).saveAll(any());
    }

    @Test
    void listScheduleExpandsOpenEndedScheduleToCoverRequestedPage() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2025, 1, 15),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(12L);
        when(billScheduleEntryRepository.countByBillIdAndOwnerIdAndDueDateGreaterThanEqual(billId, ownerId, LocalDate.of(2026, 6, 22)))
                .thenReturn(12L);
        BillScheduleEntry lastEntry = new BillScheduleEntry(
                owner,
                bill,
                12,
                LocalDate.of(2027, 6, 10),
                new BigDecimal("189.99"),
                "PLN"
        );
        when(billScheduleEntryRepository.findFirstByBillIdAndOwnerIdOrderByDueDateDescInstallmentNumberDesc(billId, ownerId))
                .thenReturn(Optional.of(lastEntry));
        when(billScheduleEntryRepository.findVisiblePageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(1, 12)
        ))
                .thenReturn(new PageImpl<>(List.of()));

        service.listSchedule(billId, PageRequest.of(1, 12));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<BillScheduleEntry>> entriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(billScheduleEntryRepository).saveAll(entriesCaptor.capture());
        List<BillScheduleEntry> entries = entriesCaptor.getValue();

        assertThat(entries).hasSize(12);
        assertThat(entries.get(0).getInstallmentNumber()).isEqualTo(13);
        assertThat(entries.get(0).getDueDate()).isEqualTo(LocalDate.of(2027, 7, 10));
        assertThat(entries.get(11).getInstallmentNumber()).isEqualTo(24);
        assertThat(entries.get(11).getDueDate()).isEqualTo(LocalDate.of(2028, 6, 10));
    }

    @Test
    void openEndedFirstPageKeepsInitialTwelveRowWindowEvenWhenSomeRowsAgeOut() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());

        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        ReflectionTestUtils.setField(counterparty, "id", UUID.randomUUID());

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2025, 1, 15),
                BillStatus.ACTIVE
        );
        ReflectionTestUtils.setField(bill, "id", billId);

        BillScheduleService service = new BillScheduleService(
                billRepository,
                billScheduleEntryRepository,
                currentUserService,
                Clock.fixed(Instant.parse("2026-06-22T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(billScheduleEntryRepository.countByBillId(billId)).thenReturn(12L);
        when(billScheduleEntryRepository.findVisiblePageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(0, 12)
        )).thenReturn(new PageImpl<>(List.of()));

        // Current product decision: page 0 keeps the originally generated
        // 12-row window and does not auto-top-up as older rows become past-due.
        service.listSchedule(billId, PageRequest.of(0, 12));

        verify(billScheduleEntryRepository, never()).saveAll(any());
    }

    @Test
    void setPaidKeepsOriginalPaidAtOnRepeatedPaidUpdates() {
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        com.moneysnapshot.counterparty.Counterparty counterparty = new com.moneysnapshot.counterparty.Counterparty(
                owner,
                "Orange Polska",
                "orange-polska",
                "12121212121212121212121212",
                null,
                null
        );
        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Internet domowy",
                "internet-domowy",
                "PLN",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                10,
                LocalDate.of(2025, 1, 15),
                BillStatus.ACTIVE
        );
        BillScheduleEntry entry = new BillScheduleEntry(
                owner,
                bill,
                1,
                LocalDate.of(2026, 7, 10),
                new BigDecimal("189.99"),
                "PLN"
        );

        entry.setPaid(true);
        OffsetDateTime firstPaidAt = entry.getPaidAt();

        entry.setPaid(true);

        assertThat(entry.getPaidAt()).isEqualTo(firstPaidAt);
    }
}
