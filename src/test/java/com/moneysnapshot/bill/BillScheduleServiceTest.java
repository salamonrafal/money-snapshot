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

    @Mock
    private BillRepository billRepository;

    @Mock
    private BillScheduleEntryRepository billScheduleEntryRepository;

    @Mock
    private CurrentUserService currentUserService;

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
        when(billScheduleEntryRepository.findUpcomingPageByBillIdAndOwnerId(
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
        when(billScheduleEntryRepository.findUpcomingPageByBillIdAndOwnerId(
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
        when(billScheduleEntryRepository.findUpcomingPageByBillIdAndOwnerId(
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
        when(billScheduleEntryRepository.findUpcomingPageByBillIdAndOwnerId(
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
        when(billScheduleEntryRepository.findUpcomingPageByBillIdAndOwnerId(
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
    void listScheduleDoesNotExpandOpenEndedScheduleOnFirstPageWhenOnlyFewUpcomingEntriesRemain() {
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
        when(billScheduleEntryRepository.findUpcomingPageByBillIdAndOwnerId(
                billId,
                ownerId,
                LocalDate.of(2026, 6, 22),
                PageRequest.of(0, 12)
        )).thenReturn(new PageImpl<>(List.of()));

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
