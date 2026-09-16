package com.moneysnapshot.retirement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.retirement.web.CreateRetirementAccountContributionRequest;
import com.moneysnapshot.retirement.web.CreateRetirementAccountRequest;
import com.moneysnapshot.retirement.web.UpdateRetirementAccountBalanceRequest;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class RetirementAccountServiceTest {

    @Mock
    private RetirementAccountRepository retirementAccountRepository;

    @Mock
    private RetirementAccountContributionRepository retirementAccountContributionRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private NameNormalizationService normalizer;

    @Test
    void createAccountDefaultsCurrencyStatusAndMonthlyContribution() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        CreateRetirementAccountRequest request = new CreateRetirementAccountRequest(
                "ike",
                "mBank",
                "IKE obligacyjne",
                "mojeike.pl",
                null,
                new BigDecimal("1234.5000"),
                null,
                LocalDate.of(2026, 9, 15),
                null
        );

        when(currentUserService.currentUser()).thenReturn(owner);
        when(normalizer.normalize("IKE obligacyjne")).thenReturn("ike-obligacyjne");
        when(retirementAccountRepository.existsByOwnerIdAndNormalizedName(ownerId, "ike-obligacyjne")).thenReturn(false);
        when(retirementAccountRepository.save(org.mockito.ArgumentMatchers.any(RetirementAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RetirementAccount savedAccount = service.createAccount(request);

        assertThat(savedAccount.getOwner()).isEqualTo(owner);
        assertThat(savedAccount.getAccountTypeCode()).isEqualTo("IKE");
        assertThat(savedAccount.getWebsiteUrl()).isEqualTo("https://mojeike.pl");
        assertThat(savedAccount.getCurrencyCode()).isEqualTo("PLN");
        assertThat(savedAccount.getBalance()).isEqualByComparingTo("1234.5");
        assertThat(savedAccount.getMonthlyContribution()).isEqualByComparingTo("0");
        assertThat(savedAccount.getStatus()).isEqualTo(RetirementAccountStatus.ACTIVE);
    }

    @Test
    void createAccountStoresProvidedCurrency() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        CreateRetirementAccountRequest request = new CreateRetirementAccountRequest(
                "ike",
                "Broker",
                "IKE EUR",
                null,
                "eur",
                new BigDecimal("1000.0000"),
                BigDecimal.ZERO,
                LocalDate.of(2026, 9, 16),
                RetirementAccountStatus.ACTIVE
        );

        when(currentUserService.currentUser()).thenReturn(owner);
        when(normalizer.normalize("IKE EUR")).thenReturn("ike-eur");
        when(retirementAccountRepository.existsByOwnerIdAndNormalizedName(ownerId, "ike-eur")).thenReturn(false);
        when(retirementAccountRepository.save(org.mockito.ArgumentMatchers.any(RetirementAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RetirementAccount savedAccount = service.createAccount(request);

        assertThat(savedAccount.getCurrencyCode()).isEqualTo("EUR");
    }

    @Test
    void createAccountRejectsDuplicateNameForCurrentOwner() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        CreateRetirementAccountRequest request = new CreateRetirementAccountRequest(
                "PPK",
                "Provider",
                "PPK",
                null,
                "PLN",
                BigDecimal.TEN,
                BigDecimal.ONE,
                LocalDate.of(2026, 9, 15),
                RetirementAccountStatus.ACTIVE
        );

        when(currentUserService.currentUser()).thenReturn(owner);
        when(normalizer.normalize("PPK")).thenReturn("ppk");
        when(retirementAccountRepository.existsByOwnerIdAndNormalizedName(ownerId, "ppk")).thenReturn(true);

        assertThatThrownBy(() -> service.createAccount(request))
                .isInstanceOf(DuplicateRetirementAccountNameException.class)
                .hasMessageContaining("ppk");

        verify(retirementAccountRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void updateAccountPreservesBalanceAndCurrencyFromStaleEditRequest() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);
        RetirementAccount account = new RetirementAccount(
                owner,
                "IKE",
                "Broker",
                "IKE PLN",
                "ike-pln",
                null,
                "PLN",
                new BigDecimal("125.0000"),
                BigDecimal.ONE,
                LocalDate.of(2026, 9, 16),
                RetirementAccountStatus.ACTIVE
        );
        ReflectionTestUtils.setField(account, "id", accountId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        CreateRetirementAccountRequest request = new CreateRetirementAccountRequest(
                "ike",
                "Broker",
                "IKE po zmianie",
                null,
                "EUR",
                new BigDecimal("100.0000"),
                BigDecimal.TEN,
                LocalDate.of(2026, 9, 1),
                RetirementAccountStatus.ACTIVE
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(retirementAccountRepository.findByIdAndOwnerIdForUpdate(accountId, ownerId)).thenReturn(Optional.of(account));
        when(normalizer.normalize("IKE po zmianie")).thenReturn("ike-po-zmianie");
        when(retirementAccountRepository.findByOwnerIdAndNormalizedName(ownerId, "ike-po-zmianie")).thenReturn(Optional.empty());
        when(retirementAccountRepository.save(account)).thenReturn(account);

        RetirementAccount savedAccount = service.updateAccount(accountId, request);

        assertThat(savedAccount.getCurrencyCode()).isEqualTo("PLN");
        assertThat(savedAccount.getBalance()).isEqualByComparingTo("125");
        assertThat(savedAccount.getBalanceUpdatedAt()).isEqualTo(LocalDate.of(2026, 9, 16));
        assertThat(savedAccount.getName()).isEqualTo("IKE po zmianie");
        assertThat(savedAccount.getMonthlyContribution()).isEqualByComparingTo("10");
        verify(retirementAccountRepository).findByIdAndOwnerIdForUpdate(accountId, ownerId);
    }

    @Test
    void updateBalanceChangesOnlyBalanceFields() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        RetirementAccount account = new RetirementAccount(
                owner,
                "IKZE",
                "DM",
                "IKZE ETF",
                "ikze-etf",
                null,
                "PLN",
                BigDecimal.TEN,
                BigDecimal.ONE,
                LocalDate.of(2026, 8, 1),
                RetirementAccountStatus.SUSPENDED
        );
        ReflectionTestUtils.setField(account, "id", accountId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(retirementAccountRepository.findByIdAndOwnerIdForUpdate(accountId, ownerId)).thenReturn(Optional.of(account));
        when(retirementAccountRepository.save(account)).thenReturn(account);

        RetirementAccount savedAccount = service.updateBalance(
                accountId,
                new UpdateRetirementAccountBalanceRequest(new BigDecimal("99.9900"), LocalDate.of(2026, 9, 15))
        );

        assertThat(savedAccount.getBalance()).isEqualByComparingTo("99.99");
        assertThat(savedAccount.getBalanceUpdatedAt()).isEqualTo(LocalDate.of(2026, 9, 15));
        assertThat(savedAccount.getMonthlyContribution()).isEqualByComparingTo("1");
        verify(retirementAccountRepository).findByIdAndOwnerIdForUpdate(accountId, ownerId);
    }

    @Test
    void updateBalanceRejectsDateBeforeCurrentBalanceUpdateDate() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        RetirementAccount account = new RetirementAccount(
                owner,
                "IKZE",
                "DM",
                "IKZE ETF",
                "ikze-etf",
                null,
                "PLN",
                new BigDecimal("125.0000"),
                BigDecimal.ONE,
                LocalDate.of(2026, 9, 16),
                RetirementAccountStatus.ACTIVE
        );
        ReflectionTestUtils.setField(account, "id", accountId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(retirementAccountRepository.findByIdAndOwnerIdForUpdate(accountId, ownerId)).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> service.updateBalance(
                accountId,
                new UpdateRetirementAccountBalanceRequest(new BigDecimal("99.0000"), LocalDate.of(2026, 9, 10))
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Balance update date");

        assertThat(account.getBalance()).isEqualByComparingTo("125");
        assertThat(account.getBalanceUpdatedAt()).isEqualTo(LocalDate.of(2026, 9, 16));
        verify(retirementAccountRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void registerContributionCalculatesHistoryAmountAndUpdatesBalance() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        RetirementAccount account = new RetirementAccount(
                owner,
                "PPK",
                "Provider",
                "PPK",
                "ppk",
                "https://ppk.example",
                "PLN",
                new BigDecimal("100.0000"),
                BigDecimal.TEN,
                LocalDate.of(2026, 9, 10),
                RetirementAccountStatus.ACTIVE
        );
        ReflectionTestUtils.setField(account, "id", accountId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(retirementAccountRepository.findByIdAndOwnerIdForUpdate(accountId, ownerId)).thenReturn(Optional.of(account));
        when(retirementAccountRepository.save(account)).thenReturn(account);
        when(retirementAccountContributionRepository.save(org.mockito.ArgumentMatchers.any(RetirementAccountContribution.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RetirementAccountContribution contribution = service.registerContribution(
                accountId,
                new CreateRetirementAccountContributionRequest(
                        new BigDecimal("125.5000"),
                        LocalDate.of(2026, 9, 15),
                        "  wplata pracodawcy  "
                )
        );

        assertThat(contribution.getRetirementAccount()).isEqualTo(account);
        assertThat(contribution.getAmount()).isEqualByComparingTo("25.5");
        assertThat(contribution.getPreviousBalance()).isEqualByComparingTo("100");
        assertThat(contribution.getCurrentBalance()).isEqualByComparingTo("125.5");
        assertThat(contribution.getContributionDate()).isEqualTo(LocalDate.of(2026, 9, 15));
        assertThat(contribution.getNote()).isEqualTo("wplata pracodawcy");
        assertThat(account.getBalance()).isEqualByComparingTo("125.5");
        assertThat(account.getBalanceUpdatedAt()).isEqualTo(LocalDate.of(2026, 9, 15));
        verify(retirementAccountRepository).findByIdAndOwnerIdForUpdate(accountId, ownerId);
        verify(retirementAccountContributionRepository).save(org.mockito.ArgumentMatchers.any(RetirementAccountContribution.class));
    }

    @Test
    void registerContributionRejectsBalanceNotGreaterThanPreviousBalance() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        RetirementAccount account = new RetirementAccount(
                owner,
                "IKE",
                "Broker",
                "IKE",
                "ike",
                null,
                "PLN",
                new BigDecimal("100.0000"),
                BigDecimal.TEN,
                LocalDate.of(2026, 9, 10),
                RetirementAccountStatus.ACTIVE
        );
        ReflectionTestUtils.setField(account, "id", accountId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(retirementAccountRepository.findByIdAndOwnerIdForUpdate(accountId, ownerId)).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> service.registerContribution(
                accountId,
                new CreateRetirementAccountContributionRequest(
                        new BigDecimal("99.0000"),
                        LocalDate.of(2026, 9, 15),
                        null
                )
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("greater");

        verify(retirementAccountRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(retirementAccountContributionRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void registerContributionRejectsDateBeforeCurrentBalanceUpdateDate() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        RetirementAccount account = new RetirementAccount(
                owner,
                "IKE",
                "Broker",
                "IKE",
                "ike",
                null,
                "PLN",
                new BigDecimal("100.0000"),
                BigDecimal.TEN,
                LocalDate.of(2026, 9, 16),
                RetirementAccountStatus.ACTIVE
        );
        ReflectionTestUtils.setField(account, "id", accountId);

        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(retirementAccountRepository.findByIdAndOwnerIdForUpdate(accountId, ownerId)).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> service.registerContribution(
                accountId,
                new CreateRetirementAccountContributionRequest(
                        new BigDecimal("125.0000"),
                        LocalDate.of(2026, 9, 10),
                        "wplata"
                )
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Balance update date");

        assertThat(account.getBalance()).isEqualByComparingTo("100");
        assertThat(account.getBalanceUpdatedAt()).isEqualTo(LocalDate.of(2026, 9, 16));
        verify(retirementAccountRepository, never()).save(org.mockito.ArgumentMatchers.any());
        verify(retirementAccountContributionRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void getAccountRejectsAccountsOutsideCurrentOwner() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        RetirementAccountService service = new RetirementAccountService(
                retirementAccountRepository,
                retirementAccountContributionRepository,
                currentUserService,
                normalizer
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(retirementAccountRepository.findByIdAndOwnerId(accountId, ownerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getAccount(accountId))
                .isInstanceOf(RetirementAccountNotFoundException.class);
    }
}
