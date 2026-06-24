package com.moneysnapshot.account;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.web.CreateAccountRequest;
import com.moneysnapshot.bill.BillRepository;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private BankRepository bankRepository;

    @Mock
    private BillRepository billRepository;

    @Mock
    private NameNormalizationService normalizer;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private CurrentUserService currentUserService;

    @Test
    void deleteAccountRejectsWhenLinkedBillsExist() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        AccountService service = new AccountService(
                accountRepository,
                bankRepository,
                billRepository,
                normalizer,
                eventPublisher,
                currentUserService
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Main account", "main-account", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        org.springframework.test.util.ReflectionTestUtils.setField(account, "id", accountId);

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(billRepository.existsByAccountIdAndOwnerId(accountId, ownerId)).thenReturn(true);

        assertThatThrownBy(() -> service.deleteAccount(accountId))
                .isInstanceOf(AccountInUseException.class)
                .hasMessageContaining("linked to existing bills");

        verify(accountRepository, never()).deleteById(accountId);
    }

    @Test
    void updateAccountPublishesCurrencySyncEventWhenCurrencyChanges() {
        UUID ownerId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        when(owner.getId()).thenReturn(ownerId);

        AccountService service = new AccountService(
                accountRepository,
                bankRepository,
                billRepository,
                normalizer,
                eventPublisher,
                currentUserService
        );

        Bank bank = new Bank(owner, "Main bank", "main-bank");
        org.springframework.test.util.ReflectionTestUtils.setField(bank, "id", UUID.randomUUID());
        Account account = new Account(bank, owner, "Main account", "main-account", "BANK_ACCOUNT", "PLN", null, new BigDecimal("10"), AccountStatus.ACTIVE);
        org.springframework.test.util.ReflectionTestUtils.setField(account, "id", accountId);

        CreateAccountRequest request = new CreateAccountRequest(
                "Main bank",
                "Main account",
                "BANK_ACCOUNT",
                "EUR",
                null,
                new BigDecimal("10"),
                AccountStatus.ACTIVE
        );

        when(normalizer.normalize("Main account")).thenReturn("main-account");
        when(normalizer.normalize("Main bank")).thenReturn("main-bank");
        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(accountRepository.findByIdAndOwnerIdWithBank(accountId, ownerId)).thenReturn(Optional.of(account));
        when(accountRepository.findByOwnerIdAndNormalizedName(ownerId, "main-account")).thenReturn(Optional.of(account));
        when(bankRepository.findByOwnerIdAndNormalizedName(ownerId, "main-bank")).thenReturn(Optional.of(bank));
        when(accountRepository.save(account)).thenReturn(account);

        service.updateAccount(accountId, request);

        verify(eventPublisher).publishEvent(new AccountCurrencyChangedEvent(accountId, "EUR"));
    }
}
