package com.moneysnapshot.bill;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.account.AccountStatus;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.bill.web.CreateBillRequest;
import com.moneysnapshot.counterparty.Counterparty;
import com.moneysnapshot.counterparty.CounterpartyRepository;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class BillServiceTest {

    @Mock
    private BillRepository billRepository;

    @Mock
    private BillScheduleEntryRepository billScheduleEntryRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CounterpartyRepository counterpartyRepository;

    @Mock
    private NameNormalizationService normalizer;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Test
    void createBillUsesOwnedAccountAndCounterparty() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", accountId);
        Counterparty counterparty = new Counterparty(owner, "Orange Polska", "orange-polska", "12121212121212121212121212", null, null);
        ReflectionTestUtils.setField(counterparty, "id", counterpartyId);

        CreateBillRequest request = new CreateBillRequest(
                "Internet domowy",
                new BigDecimal("189.99"),
                BillDurationType.UNTIL_DATE,
                LocalDate.of(2027, 12, 31),
                null,
                5,
                LocalDate.of(2025, 2, 1),
                counterpartyId,
                accountId,
                BillStatus.ACTIVE
        );

        when(currentUserService.currentUser()).thenReturn(owner);
        when(normalizer.normalize("Internet domowy")).thenReturn("internet-domowy");
        when(billRepository.findByOwnerIdAndNormalizedName(ownerId, "internet-domowy")).thenReturn(Optional.empty());
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(billRepository.save(any(Bill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Bill bill = service.createBill(request);

        assertThat(bill.getName()).isEqualTo("Internet domowy");
        assertThat(bill.getAccount().getId()).isEqualTo(accountId);
        assertThat(bill.getCounterparty().getId()).isEqualTo(counterpartyId);
        assertThat(bill.getCurrencyCode()).isEqualTo("PLN");
        verify(eventPublisher).publishEvent(argThat((Object event) -> event instanceof BillScheduleRegenerationRequestedEvent changedEvent
                && !changedEvent.regenerateFromCurrentDate()));
        verify(billRepository).flush();
    }

    @Test
    void listBillsReturnsRepositoryResultsForCurrentOwner() {
        UUID ownerId = UUID.randomUUID();
        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        Bill bill = org.mockito.Mockito.mock(Bill.class);
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(ownerId)).thenReturn(List.of(bill));

        assertThat(service.listBills()).containsExactly(bill);
    }

    @Test
    void createBillRejectsDuplicateNormalizedName() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        CreateBillRequest request = new CreateBillRequest(
                "Internet domowy",
                new BigDecimal("189.99"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                5,
                LocalDate.of(2025, 2, 1),
                UUID.randomUUID(),
                UUID.randomUUID(),
                BillStatus.ACTIVE
        );

        when(currentUserService.currentUser()).thenReturn(owner);
        when(normalizer.normalize("Internet domowy")).thenReturn("internet-domowy");
        when(billRepository.findByOwnerIdAndNormalizedName(ownerId, "internet-domowy"))
                .thenReturn(Optional.of(org.mockito.Mockito.mock(Bill.class)));

        assertThatThrownBy(() -> service.createBill(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409 CONFLICT");
    }

    @Test
    void createBillRejectsFixedDateEarlierThanStartDate() {
        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        CreateBillRequest request = new CreateBillRequest(
                "Internet domowy",
                new BigDecimal("189.99"),
                BillDurationType.UNTIL_DATE,
                LocalDate.of(2026, 6, 30),
                null,
                5,
                LocalDate.of(2026, 7, 1),
                UUID.randomUUID(),
                UUID.randomUUID(),
                BillStatus.ACTIVE
        );

        assertThatThrownBy(() -> service.createBill(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400 BAD_REQUEST")
                .hasMessageContaining("End date must be on or after start date.");
    }

    @Test
    void createBillRejectsInstallmentCountGreaterThanGenerationLimit() {
        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        CreateBillRequest request = new CreateBillRequest(
                "Internet domowy",
                new BigDecimal("189.99"),
                BillDurationType.INSTALLMENTS,
                null,
                601,
                5,
                LocalDate.of(2026, 7, 1),
                UUID.randomUUID(),
                UUID.randomUUID(),
                BillStatus.ACTIVE
        );

        assertThatThrownBy(() -> service.createBill(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400 BAD_REQUEST")
                .hasMessageContaining("Installment count cannot exceed 600.");
    }

    @Test
    void createBillRejectsFixedDateScheduleLongerThanGenerationLimit() {
        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        CreateBillRequest request = new CreateBillRequest(
                "Internet domowy",
                new BigDecimal("189.99"),
                BillDurationType.UNTIL_DATE,
                LocalDate.of(2076, 7, 31),
                null,
                5,
                LocalDate.of(2026, 7, 1),
                UUID.randomUUID(),
                UUID.randomUUID(),
                BillStatus.ACTIVE
        );

        assertThatThrownBy(() -> service.createBill(request))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("400 BAD_REQUEST")
                .hasMessageContaining("Fixed-date bills cannot span more than 600 scheduled months.");
    }

    @Test
    void updateBillReplacesCurrentValues() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());
        Account account = new Account(bank, owner, "Home account", "home-account", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", accountId);
        Counterparty counterparty = new Counterparty(owner, "PGE", "pge", "12121212121212121212121212", null, null);
        ReflectionTestUtils.setField(counterparty, "id", counterpartyId);
        Bill existingBill = new Bill(owner, counterparty, account, "Old bill", "old-bill", "PLN", new BigDecimal("10.00"), BillDurationType.OPEN_ENDED, null, null, 3, LocalDate.of(2025, 1, 1), BillStatus.ACTIVE);
        ReflectionTestUtils.setField(existingBill, "id", billId);

        CreateBillRequest request = new CreateBillRequest(
                "Energia",
                new BigDecimal("74.50"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                12,
                LocalDate.of(2026, 1, 12),
                counterpartyId,
                accountId,
                BillStatus.SUSPENDED
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(normalizer.normalize("Energia")).thenReturn("energia");
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(existingBill));
        when(billRepository.findByOwnerIdAndNormalizedName(ownerId, "energia")).thenReturn(Optional.empty());
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(billRepository.save(existingBill)).thenReturn(existingBill);

        Bill updated = service.updateBill(billId, request);

        assertThat(updated.getName()).isEqualTo("Energia");
        assertThat(updated.getInstallmentCount()).isEqualTo(12);
        assertThat(updated.getRepaymentDay()).isEqualTo(12);
        assertThat(updated.getStatus()).isEqualTo(BillStatus.SUSPENDED);
        verify(billRepository).save(existingBill);
        verify(eventPublisher).publishEvent(argThat((Object event) -> event instanceof BillScheduleRegenerationRequestedEvent changedEvent
                && changedEvent.regenerateFromCurrentDate()));
        verify(billRepository).flush();
    }

    @Test
    void updateBillWithoutScheduleChangeDoesNotRegenerateSchedule() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());
        Account account = new Account(bank, owner, "Home account", "home-account", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", accountId);
        Counterparty counterparty = new Counterparty(owner, "PGE", "pge", "12121212121212121212121212", null, null);
        ReflectionTestUtils.setField(counterparty, "id", counterpartyId);
        Bill existingBill = new Bill(owner, counterparty, account, "Energia", "energia", "PLN", new BigDecimal("74.50"), BillDurationType.INSTALLMENTS, null, 12, 12, LocalDate.of(2026, 1, 12), BillStatus.SUSPENDED);
        ReflectionTestUtils.setField(existingBill, "id", billId);

        CreateBillRequest request = new CreateBillRequest(
                "Energia",
                new BigDecimal("74.50"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                12,
                LocalDate.of(2026, 1, 12),
                counterpartyId,
                accountId,
                BillStatus.ACTIVE
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(normalizer.normalize("Energia")).thenReturn("energia");
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(existingBill));
        when(billRepository.findByOwnerIdAndNormalizedName(ownerId, "energia")).thenReturn(Optional.empty());
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(billRepository.save(existingBill)).thenReturn(existingBill);

        service.updateBill(billId, request);

        verify(billRepository).flush();
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void updateBillToCompletedDoesNotTouchScheduleWhenStructureIsUnchanged() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher,
                Clock.fixed(Instant.parse("2026-06-23T09:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());
        Account account = new Account(bank, owner, "Home account", "home-account", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", accountId);
        Counterparty counterparty = new Counterparty(owner, "PGE", "pge", "12121212121212121212121212", null, null);
        ReflectionTestUtils.setField(counterparty, "id", counterpartyId);
        Bill existingBill = new Bill(owner, counterparty, account, "Energia", "energia", "PLN", new BigDecimal("74.50"), BillDurationType.INSTALLMENTS, null, 12, 12, LocalDate.of(2026, 1, 12), BillStatus.ACTIVE);
        ReflectionTestUtils.setField(existingBill, "id", billId);

        CreateBillRequest request = new CreateBillRequest(
                "Energia",
                new BigDecimal("74.50"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                12,
                LocalDate.of(2026, 1, 12),
                counterpartyId,
                accountId,
                BillStatus.COMPLETED
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(normalizer.normalize("Energia")).thenReturn("energia");
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(existingBill));
        when(billRepository.findByOwnerIdAndNormalizedName(ownerId, "energia")).thenReturn(Optional.empty());
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(billRepository.save(existingBill)).thenReturn(existingBill);

        service.updateBill(billId, request);

        verify(eventPublisher, never()).publishEvent(any());
        verify(billScheduleEntryRepository, never()).deleteByBillIdAndDueDateGreaterThanEqual(any(), any());
        verify(billScheduleEntryRepository, never()).flush();
    }

    @Test
    void updateBillFromCompletedToActiveDoesNotRegenerateScheduleWhenStructureIsUnchanged() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());
        Account account = new Account(bank, owner, "Home account", "home-account", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", accountId);
        Counterparty counterparty = new Counterparty(owner, "PGE", "pge", "12121212121212121212121212", null, null);
        ReflectionTestUtils.setField(counterparty, "id", counterpartyId);
        Bill existingBill = new Bill(owner, counterparty, account, "Energia", "energia", "PLN", new BigDecimal("74.50"), BillDurationType.INSTALLMENTS, null, 12, 12, LocalDate.of(2026, 1, 12), BillStatus.COMPLETED);
        ReflectionTestUtils.setField(existingBill, "id", billId);

        CreateBillRequest request = new CreateBillRequest(
                "Energia",
                new BigDecimal("74.50"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                12,
                LocalDate.of(2026, 1, 12),
                counterpartyId,
                accountId,
                BillStatus.ACTIVE
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(normalizer.normalize("Energia")).thenReturn("energia");
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(existingBill));
        when(billRepository.findByOwnerIdAndNormalizedName(ownerId, "energia")).thenReturn(Optional.empty());
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(billRepository.save(existingBill)).thenReturn(existingBill);

        service.updateBill(billId, request);

        verify(eventPublisher, never()).publishEvent(any());
        verify(billScheduleEntryRepository, never()).deleteByBillIdAndDueDateGreaterThanEqual(any(), any());
        verify(billScheduleEntryRepository, never()).flush();
    }

    @Test
    void updateBillWithSameAmountDifferentScaleDoesNotRegenerateSchedule() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID counterpartyId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);

        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());
        Account account = new Account(bank, owner, "Home account", "home-account", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        ReflectionTestUtils.setField(account, "id", accountId);
        Counterparty counterparty = new Counterparty(owner, "PGE", "pge", "12121212121212121212121212", null, null);
        ReflectionTestUtils.setField(counterparty, "id", counterpartyId);
        Bill existingBill = new Bill(
                owner,
                counterparty,
                account,
                "Energia",
                "energia",
                "PLN",
                new BigDecimal("74.5000"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                12,
                LocalDate.of(2026, 1, 12),
                BillStatus.SUSPENDED
        );
        ReflectionTestUtils.setField(existingBill, "id", billId);

        CreateBillRequest request = new CreateBillRequest(
                "Energia po zmianie nazwy",
                new BigDecimal("74.5"),
                BillDurationType.INSTALLMENTS,
                null,
                12,
                12,
                LocalDate.of(2026, 1, 12),
                counterpartyId,
                accountId,
                BillStatus.ACTIVE
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(normalizer.normalize("Energia po zmianie nazwy")).thenReturn("energia-po-zmianie-nazwy");
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(existingBill));
        when(billRepository.findByOwnerIdAndNormalizedName(ownerId, "energia-po-zmianie-nazwy")).thenReturn(Optional.empty());
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(counterpartyRepository.findByIdAndOwnerId(counterpartyId, ownerId)).thenReturn(Optional.of(counterparty));
        when(billRepository.save(existingBill)).thenReturn(existingBill);

        service.updateBill(billId, request);

        verify(billRepository).flush();
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void deleteBillDeletesOwnedEntityAndScheduleEntries() {
        UUID ownerId = UUID.randomUUID();
        UUID billId = UUID.randomUUID();
        BillService service = new BillService(
                billRepository,
                billScheduleEntryRepository,
                accountRepository,
                counterpartyRepository,
                normalizer,
                currentUserService,
                eventPublisher
        );

        Bill bill = org.mockito.Mockito.mock(Bill.class);
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findByIdAndOwnerId(billId, ownerId)).thenReturn(Optional.of(bill));
        when(bill.getId()).thenReturn(billId);

        service.deleteBill(billId);

        verify(billScheduleEntryRepository).deleteByBillId(billId);
        verify(billRepository).delete(bill);
        verify(billRepository).flush();
    }
}
