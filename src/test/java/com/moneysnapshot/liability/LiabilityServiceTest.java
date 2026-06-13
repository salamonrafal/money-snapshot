package com.moneysnapshot.liability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

import com.moneysnapshot.account.Bank;
import com.moneysnapshot.account.BankRepository;
import com.moneysnapshot.liability.web.CreateLiabilityRequest;
import com.moneysnapshot.liability.web.LiabilityDashboardResponse;
import com.moneysnapshot.liability.web.RegisterLiabilityRepaymentRequest;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class LiabilityServiceTest {

    @Mock
    private LiabilityRepository liabilityRepository;

    @Mock
    private LiabilityRepaymentRepository liabilityRepaymentRepository;

    @Mock
    private BankRepository bankRepository;

    @Mock
    private NameNormalizationService normalizer;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private UserSettingsService userSettingsService;

    @Test
    void summaryUsesConfiguredRepaymentDayRatherThanRepaymentStartDay() {
        UUID ownerId = UUID.randomUUID();
        UUID bankId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        Clock clock = Clock.fixed(Instant.parse("2026-06-12T00:00:00Z"), ZoneOffset.UTC);

        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService,
                clock
        );

        Bank bank = org.mockito.Mockito.mock(Bank.class);
        Liability liability = org.mockito.Mockito.mock(Liability.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepository.findAllByOwnerIdOrderByBankNameAndName(ownerId)).thenReturn(List.of(liability));
        when(liabilityRepaymentRepository.findAllByOwnerIdOrderByLiabilityNameAndRepaymentDateDesc(ownerId)).thenReturn(List.of());

        when(liability.getId()).thenReturn(liabilityId);
        when(liability.getBank()).thenReturn(bank);
        when(bank.getId()).thenReturn(bankId);
        when(bank.getName()).thenReturn("Bank");
        when(liability.getName()).thenReturn("Mortgage");
        when(liability.getNormalizedName()).thenReturn("mortgage");
        when(liability.getLiabilityTypeCode()).thenReturn(LiabilityTypeCode.MORTGAGE);
        when(liability.getCurrencyCode()).thenReturn("PLN");
        when(liability.getOriginalAmount()).thenReturn(new BigDecimal("100000"));
        when(liability.getCurrentAmount()).thenReturn(new BigDecimal("90000"));
        when(liability.getInstallmentAmount()).thenReturn(new BigDecimal("1200"));
        when(liability.getCreditCardLimit()).thenReturn(null);
        when(liability.getCreditCardMinimumPayment()).thenReturn(null);
        when(liability.getRepaymentStartDate()).thenReturn(LocalDate.of(2026, 1, 10));
        when(liability.getEndDate()).thenReturn(null);
        when(liability.getInstallmentCount()).thenReturn(null);
        when(liability.getFirstRepaymentDay()).thenReturn(25);
        when(liability.getScheduleMode()).thenReturn(LiabilityScheduleMode.END_DATE);
        when(liability.getNote()).thenReturn("");
        when(liability.getStatus()).thenReturn(LiabilityStatus.ACTIVE);

        LiabilityDashboardResponse response = service.listDashboard();

        assertThat(response.summary().nextPaymentDate()).isEqualTo(LocalDate.of(2026, 6, 25));
    }

    @Test
    void summaryCurrentDebtIgnoresNonActiveLiabilities() {
        UUID ownerId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability activeLiability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("900"));
        Liability completedLiability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("500"));
        Liability suspendedLiability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("300"));
        completedLiability.updateDetails(
                bank,
                "Loan",
                "loan",
                LiabilityTypeCode.MORTGAGE,
                "PLN",
                new BigDecimal("1000"),
                new BigDecimal("500"),
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2030, 6, 1),
                null,
                10,
                LiabilityScheduleMode.END_DATE,
                null,
                LiabilityStatus.COMPLETED
        );
        suspendedLiability.updateDetails(
                bank,
                "Loan",
                "loan",
                LiabilityTypeCode.MORTGAGE,
                "PLN",
                new BigDecimal("1000"),
                new BigDecimal("300"),
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2030, 6, 1),
                null,
                10,
                LiabilityScheduleMode.END_DATE,
                null,
                LiabilityStatus.SUSPENDED
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepository.findAllByOwnerIdOrderByBankNameAndName(ownerId))
                .thenReturn(List.of(activeLiability, completedLiability, suspendedLiability));
        when(liabilityRepaymentRepository.findAllByOwnerIdOrderByLiabilityNameAndRepaymentDateDesc(ownerId)).thenReturn(List.of());

        LiabilityDashboardResponse response = service.listDashboard();

        assertThat(response.summary().currentDebtAmount()).isEqualByComparingTo("900");
    }

    @Test
    void listDashboardDoesNotUseJvmLocalCache() {
        UUID ownerId = UUID.randomUUID();
        UUID bankId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        Bank bank = org.mockito.Mockito.mock(Bank.class);
        Liability liability = org.mockito.Mockito.mock(Liability.class);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepository.findAllByOwnerIdOrderByBankNameAndName(ownerId)).thenReturn(List.of(liability));
        when(liabilityRepaymentRepository.findAllByOwnerIdOrderByLiabilityNameAndRepaymentDateDesc(ownerId)).thenReturn(List.of());

        when(liability.getId()).thenReturn(liabilityId);
        when(liability.getBank()).thenReturn(bank);
        when(bank.getId()).thenReturn(bankId);
        when(bank.getName()).thenReturn("Bank");
        when(liability.getName()).thenReturn("Loan");
        when(liability.getNormalizedName()).thenReturn("loan");
        when(liability.getLiabilityTypeCode()).thenReturn(LiabilityTypeCode.MORTGAGE);
        when(liability.getCurrencyCode()).thenReturn("PLN");
        when(liability.getOriginalAmount()).thenReturn(new BigDecimal("1000"));
        when(liability.getCurrentAmount()).thenReturn(new BigDecimal("900"));
        when(liability.getInstallmentAmount()).thenReturn(new BigDecimal("100"));
        when(liability.getCreditCardLimit()).thenReturn(null);
        when(liability.getCreditCardMinimumPayment()).thenReturn(null);
        when(liability.getRepaymentStartDate()).thenReturn(LocalDate.of(2026, 1, 10));
        when(liability.getEndDate()).thenReturn(null);
        when(liability.getInstallmentCount()).thenReturn(null);
        when(liability.getFirstRepaymentDay()).thenReturn(10);
        when(liability.getScheduleMode()).thenReturn(LiabilityScheduleMode.END_DATE);
        when(liability.getNote()).thenReturn("");
        when(liability.getStatus()).thenReturn(LiabilityStatus.ACTIVE);

        assertThat(service.listDashboard().summary().currentDebtAmount()).isEqualByComparingTo("900");
        assertThat(service.listDashboard().summary().currentDebtAmount()).isEqualByComparingTo("900");
        verify(liabilityRepository, org.mockito.Mockito.times(2)).findAllByOwnerIdOrderByBankNameAndName(ownerId);
        verify(liabilityRepaymentRepository, org.mockito.Mockito.times(2)).findAllByOwnerIdOrderByLiabilityNameAndRepaymentDateDesc(ownerId);
    }

    @Test
    void updateCreditCardRepaymentReplaysFromStartingDebtInsteadOfCardLimit() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID firstRepaymentId = UUID.randomUUID();
        UUID targetRepaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = creditCardLiability(bank, owner, new BigDecimal("10000"), new BigDecimal("800"));
        setEntityField(liability, "id", liabilityId);
        LiabilityRepayment firstRepayment = repayment(liability, owner, firstRepaymentId, LocalDate.of(2026, 6, 1), "900", "100", 1);
        LiabilityRepayment targetRepayment = repayment(liability, owner, targetRepaymentId, LocalDate.of(2026, 6, 10), "800", "100", 2);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepaymentRepository.findByIdAndOwnerId(targetRepaymentId, ownerId)).thenReturn(java.util.Optional.of(targetRepayment));
        when(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liabilityId)).thenReturn(List.of(firstRepayment, targetRepayment));

        service.updateRepayment(targetRepaymentId, new RegisterLiabilityRepaymentRequest(
                LocalDate.of(2026, 6, 10),
                LiabilityRepaymentSourceType.REPAYMENT_AMOUNT,
                new BigDecimal("150"),
                "Updated"
        ));

        assertThat(firstRepayment.getCurrentAmount()).isEqualByComparingTo("900");
        assertThat(targetRepayment.getAmount()).isEqualByComparingTo("150");
        assertThat(targetRepayment.getCurrentAmount()).isEqualByComparingTo("750");
        assertThat(liability.getCurrentAmount()).isEqualByComparingTo("750");
    }

    @Test
    void deleteOnlyCreditCardRepaymentRestoresDebtBeforeThatRepaymentInsteadOfCardLimit() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID repaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = creditCardLiability(bank, owner, new BigDecimal("10000"), new BigDecimal("900"));
        setEntityField(liability, "id", liabilityId);
        LiabilityRepayment repayment = repayment(liability, owner, repaymentId, LocalDate.of(2026, 6, 1), "900", "100", 1);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepaymentRepository.findByIdAndOwnerId(repaymentId, ownerId)).thenReturn(java.util.Optional.of(repayment));
        when(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liabilityId))
                .thenReturn(List.of(repayment))
                .thenReturn(List.of());

        service.deleteRepayment(repaymentId);

        assertThat(liability.getCurrentAmount()).isEqualByComparingTo("1000");
        verify(liabilityRepaymentRepository).delete(repayment);
    }

    @Test
    void createCreditCardRejectsCurrentAmountAboveLimit() {
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        assertThatThrownBy(() -> service.createLiability(creditCardRequest(new BigDecimal("1000"), new BigDecimal("1000.01"))))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(liabilityRepository, never()).save(org.mockito.Mockito.any());
    }

    @Test
    void updateCreditCardRejectsCurrentAmountAboveLimitBeforeLoadingLiability() {
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        assertThatThrownBy(() -> service.updateLiability(UUID.randomUUID(), creditCardRequest(new BigDecimal("1000"), new BigDecimal("1200"))))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(liabilityRepository, never()).findByIdAndOwnerId(org.mockito.Mockito.any(), org.mockito.Mockito.any());
    }

    @Test
    void createInstallmentPlanRejectsNonPositiveInstallmentCount() {
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        for (Integer installmentCount : List.of(0, -1)) {
            List<CreateLiabilityRequest> requests = List.of(
                    installmentPlanRequest(LiabilityTypeCode.LEASING, null, installmentCount),
                    installmentPlanRequest(LiabilityTypeCode.INSTALLMENTS, null, installmentCount),
                    installmentPlanRequest(LiabilityTypeCode.OTHER, LiabilityScheduleMode.INSTALLMENTS, installmentCount)
            );

            for (CreateLiabilityRequest request : requests) {
                assertThatThrownBy(() -> service.createLiability(request))
                        .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                                assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
            }
        }
        verify(liabilityRepository, never()).save(org.mockito.Mockito.any());
    }

    @Test
    void createOtherLiabilityWithoutScheduleModeRejectsMissingEndDate() {
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        CreateLiabilityRequest request = new CreateLiabilityRequest(
                "Other liability",
                "Bank",
                LiabilityTypeCode.OTHER,
                null,
                new BigDecimal("1000"),
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                null,
                null,
                10,
                null,
                LiabilityStatus.ACTIVE
        );

        assertThatThrownBy(() -> service.createLiability(request))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(liabilityRepository, never()).save(org.mockito.Mockito.any());
    }

    @Test
    void registerBackdatedRepaymentReplaysExistingRepayments() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID existingRepaymentId = UUID.randomUUID();
        UUID newRepaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("800"));
        setEntityField(liability, "id", liabilityId);
        LiabilityRepayment existingRepayment = repayment(liability, owner, existingRepaymentId, LocalDate.of(2026, 6, 10), "800", "200", 2);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(currentUserService.currentUser()).thenReturn(owner);
        when(liabilityRepository.findByIdAndOwnerId(liabilityId, ownerId)).thenReturn(java.util.Optional.of(liability));
        when(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liabilityId)).thenReturn(List.of(existingRepayment));
        when(liabilityRepaymentRepository.save(org.mockito.Mockito.any(LiabilityRepayment.class))).thenAnswer(invocation -> {
            LiabilityRepayment repayment = invocation.getArgument(0);
            setEntityField(repayment, "id", newRepaymentId);
            setEntityField(repayment, "createdAt", OffsetDateTime.of(2026, 6, 1, 0, 0, 0, 0, ZoneOffset.UTC));
            return repayment;
        });

        LiabilityRepayment savedRepayment = service.registerRepayment(liabilityId, new RegisterLiabilityRepaymentRequest(
                LocalDate.of(2026, 6, 1),
                LiabilityRepaymentSourceType.REPAYMENT_AMOUNT,
                new BigDecimal("100"),
                null
        ));

        assertThat(savedRepayment.getCurrentAmount()).isEqualByComparingTo("900");
        assertThat(existingRepayment.getCurrentAmount()).isEqualByComparingTo("700");
        assertThat(liability.getCurrentAmount()).isEqualByComparingTo("700");
    }

    @Test
    void registerBackdatedRepaymentRejectsReplayThatWouldPushLaterBalanceBelowZero() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID existingRepaymentId = UUID.randomUUID();
        UUID newRepaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("100"));
        setEntityField(liability, "id", liabilityId);
        LiabilityRepayment existingRepayment = repayment(liability, owner, existingRepaymentId, LocalDate.of(2026, 6, 10), "100", "900", 2);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(currentUserService.currentUser()).thenReturn(owner);
        when(liabilityRepository.findByIdAndOwnerId(liabilityId, ownerId)).thenReturn(java.util.Optional.of(liability));
        when(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liabilityId)).thenReturn(List.of(existingRepayment));
        when(liabilityRepaymentRepository.save(org.mockito.Mockito.any(LiabilityRepayment.class))).thenAnswer(invocation -> {
            LiabilityRepayment repayment = invocation.getArgument(0);
            setEntityField(repayment, "id", newRepaymentId);
            setEntityField(repayment, "createdAt", OffsetDateTime.of(2026, 6, 1, 0, 0, 0, 0, ZoneOffset.UTC));
            return repayment;
        });

        assertThatThrownBy(() -> service.registerRepayment(liabilityId, new RegisterLiabilityRepaymentRequest(
                LocalDate.of(2026, 6, 1),
                LiabilityRepaymentSourceType.REPAYMENT_AMOUNT,
                new BigDecimal("200"),
                null
        )))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(liabilityRepository, never()).save(org.mockito.Mockito.any());
    }

    @Test
    void registerRepaymentRejectsNonActiveLiability() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("800"));
        setEntityField(liability, "id", liabilityId);
        liability.updateDetails(
                bank,
                "Loan",
                "loan",
                LiabilityTypeCode.MORTGAGE,
                "PLN",
                new BigDecimal("1000"),
                new BigDecimal("800"),
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2030, 6, 1),
                null,
                10,
                LiabilityScheduleMode.END_DATE,
                null,
                LiabilityStatus.SUSPENDED
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepository.findByIdAndOwnerId(liabilityId, ownerId)).thenReturn(Optional.of(liability));

        assertThatThrownBy(() -> service.registerRepayment(liabilityId, new RegisterLiabilityRepaymentRequest(
                LocalDate.of(2026, 6, 15),
                LiabilityRepaymentSourceType.REPAYMENT_AMOUNT,
                new BigDecimal("100"),
                null
        )))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(liabilityRepaymentRepository, never()).save(org.mockito.Mockito.any());
        verify(liabilityRepository, never()).save(org.mockito.Mockito.any());
    }

    @Test
    void updateRepaymentRejectsReplayThatWouldPushLaterBalanceBelowZero() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID firstRepaymentId = UUID.randomUUID();
        UUID targetRepaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("0"));
        setEntityField(liability, "id", liabilityId);
        LiabilityRepayment firstRepayment = repayment(liability, owner, firstRepaymentId, LocalDate.of(2026, 6, 1), "100", "900", 1);
        LiabilityRepayment targetRepayment = repayment(liability, owner, targetRepaymentId, LocalDate.of(2026, 6, 10), "0", "100", 2);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepaymentRepository.findByIdAndOwnerId(targetRepaymentId, ownerId)).thenReturn(java.util.Optional.of(targetRepayment));
        when(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liabilityId)).thenReturn(List.of(firstRepayment, targetRepayment));

        assertThatThrownBy(() -> service.updateRepayment(targetRepaymentId, new RegisterLiabilityRepaymentRequest(
                LocalDate.of(2026, 5, 30),
                LiabilityRepaymentSourceType.REPAYMENT_AMOUNT,
                new BigDecimal("200"),
                "Updated"
        )))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(liabilityRepository, never()).save(org.mockito.Mockito.any());
    }

    @Test
    void updateRepaymentRejectsNonActiveLiability() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID repaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("800"));
        setEntityField(liability, "id", liabilityId);
        liability.updateDetails(
                bank,
                "Loan",
                "loan",
                LiabilityTypeCode.MORTGAGE,
                "PLN",
                new BigDecimal("1000"),
                new BigDecimal("800"),
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2030, 6, 1),
                null,
                10,
                LiabilityScheduleMode.END_DATE,
                null,
                LiabilityStatus.COMPLETED
        );
        LiabilityRepayment repayment = repayment(liability, owner, repaymentId, LocalDate.of(2026, 6, 10), "800", "200", 1);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(liabilityRepaymentRepository.findByIdAndOwnerId(repaymentId, ownerId)).thenReturn(Optional.of(repayment));

        assertThatThrownBy(() -> service.updateRepayment(repaymentId, new RegisterLiabilityRepaymentRequest(
                LocalDate.of(2026, 6, 15),
                LiabilityRepaymentSourceType.REPAYMENT_AMOUNT,
                new BigDecimal("100"),
                "Updated"
        )))
                .isInstanceOfSatisfying(ResponseStatusException.class, exception ->
                        assertThat(exception.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(liabilityRepository, never()).save(org.mockito.Mockito.any());
    }

    @Test
    void updateLoanWithRepaymentsRecalculatesCurrentAmountFromRepaymentHistory() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID repaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = loanLiability(bank, owner, new BigDecimal("1000"), new BigDecimal("800"));
        setEntityField(liability, "id", liabilityId);
        LiabilityRepayment repayment = repayment(liability, owner, repaymentId, LocalDate.of(2026, 6, 10), "800", "200", 1);
        prepareLiabilityUpdate(liabilityId, liability, ownerId, owner, bank, "Loan", "loan");
        when(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liabilityId)).thenReturn(List.of(repayment));

        service.updateLiability(liabilityId, loanRequest(new BigDecimal("500")));

        assertThat(repayment.getCurrentAmount()).isEqualByComparingTo("800");
        assertThat(liability.getCurrentAmount()).isEqualByComparingTo("800");
    }

    @Test
    void updateCreditCardWithRepaymentsReconcilesRepaymentSnapshotsToRequestedDebt() {
        UUID ownerId = UUID.randomUUID();
        UUID liabilityId = UUID.randomUUID();
        UUID firstRepaymentId = UUID.randomUUID();
        UUID secondRepaymentId = UUID.randomUUID();
        LiabilityService service = new LiabilityService(
                liabilityRepository,
                liabilityRepaymentRepository,
                bankRepository,
                normalizer,
                currentUserService,
                userSettingsService
        );

        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Bank", "bank");
        Liability liability = creditCardLiability(bank, owner, new BigDecimal("10000"), new BigDecimal("800"));
        setEntityField(liability, "id", liabilityId);
        LiabilityRepayment firstRepayment = repayment(liability, owner, firstRepaymentId, LocalDate.of(2026, 6, 1), "900", "100", 1);
        LiabilityRepayment secondRepayment = repayment(liability, owner, secondRepaymentId, LocalDate.of(2026, 6, 10), "800", "100", 2);
        prepareLiabilityUpdate(liabilityId, liability, ownerId, owner, bank, "Credit card", "credit-card");
        when(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liabilityId)).thenReturn(List.of(firstRepayment, secondRepayment));

        service.updateLiability(liabilityId, creditCardRequest(new BigDecimal("10000"), new BigDecimal("700")));

        assertThat(firstRepayment.getCurrentAmount()).isEqualByComparingTo("800");
        assertThat(secondRepayment.getCurrentAmount()).isEqualByComparingTo("700");
        assertThat(liability.getCurrentAmount()).isEqualByComparingTo("700");
    }

    private Liability loanLiability(Bank bank, AppUser owner, BigDecimal originalAmount, BigDecimal currentAmount) {
        return new Liability(
                bank,
                owner,
                "Loan",
                "loan",
                LiabilityTypeCode.MORTGAGE,
                "PLN",
                originalAmount,
                currentAmount,
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2030, 6, 1),
                null,
                10,
                LiabilityScheduleMode.END_DATE,
                null,
                LiabilityStatus.ACTIVE
        );
    }

    private CreateLiabilityRequest loanRequest(BigDecimal currentAmount) {
        return new CreateLiabilityRequest(
                "Loan",
                "Bank",
                LiabilityTypeCode.MORTGAGE,
                null,
                currentAmount,
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2030, 6, 1),
                null,
                10,
                null,
                LiabilityStatus.ACTIVE
        );
    }

    private CreateLiabilityRequest installmentPlanRequest(
            LiabilityTypeCode type,
            LiabilityScheduleMode scheduleMode,
            Integer installmentCount
    ) {
        return new CreateLiabilityRequest(
                "Installment plan",
                "Bank",
                type,
                scheduleMode,
                new BigDecimal("1000"),
                new BigDecimal("100"),
                null,
                null,
                LocalDate.of(2026, 6, 1),
                null,
                installmentCount,
                10,
                null,
                LiabilityStatus.ACTIVE
        );
    }

    private void prepareLiabilityUpdate(
            UUID liabilityId,
            Liability liability,
            UUID ownerId,
            AppUser owner,
            Bank bank,
            String name,
            String normalizedName
    ) {
        when(owner.getId()).thenReturn(ownerId);
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(currentUserService.currentUser()).thenReturn(owner);
        when(liabilityRepository.findByIdAndOwnerId(liabilityId, ownerId)).thenReturn(Optional.of(liability));
        when(normalizer.normalize(name)).thenReturn(normalizedName);
        when(normalizer.normalize("Bank")).thenReturn("bank");
        when(liabilityRepository.findByOwnerIdAndNormalizedNameAndIdNot(ownerId, normalizedName, liabilityId)).thenReturn(Optional.empty());
        when(bankRepository.findByOwnerIdAndNormalizedName(ownerId, "bank")).thenReturn(Optional.of(bank));
    }

    private Liability creditCardLiability(Bank bank, AppUser owner, BigDecimal limit, BigDecimal currentAmount) {
        return new Liability(
                bank,
                owner,
                "Credit card",
                "credit-card",
                LiabilityTypeCode.CREDIT_CARD,
                "PLN",
                limit,
                currentAmount,
                null,
                limit,
                new BigDecimal("50"),
                LocalDate.of(2026, 6, 1),
                null,
                null,
                10,
                null,
                null,
                LiabilityStatus.ACTIVE
        );
    }

    private CreateLiabilityRequest creditCardRequest(BigDecimal limit, BigDecimal currentAmount) {
        return new CreateLiabilityRequest(
                "Credit card",
                "Bank",
                LiabilityTypeCode.CREDIT_CARD,
                null,
                currentAmount,
                null,
                limit,
                new BigDecimal("50"),
                LocalDate.of(2026, 6, 1),
                null,
                null,
                10,
                null,
                LiabilityStatus.ACTIVE
        );
    }

    private LiabilityRepayment repayment(
            Liability liability,
            AppUser owner,
            UUID id,
            LocalDate repaymentDate,
            String currentAmount,
            String amount,
            int createdAtDay
    ) {
        LiabilityRepayment repayment = new LiabilityRepayment(
                liability,
                owner,
                repaymentDate,
                new BigDecimal(currentAmount),
                new BigDecimal(amount),
                null
        );
        setEntityField(repayment, "id", id);
        setEntityField(repayment, "createdAt", OffsetDateTime.of(2026, 6, createdAtDay, 0, 0, 0, 0, ZoneOffset.UTC));
        return repayment;
    }

    private void setEntityField(Object target, String name, Object value) {
        ReflectionTestUtils.setField(target, name, value);
    }
}
