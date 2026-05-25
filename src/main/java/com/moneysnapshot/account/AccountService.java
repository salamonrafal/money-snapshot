package com.moneysnapshot.account;

import com.moneysnapshot.account.web.CreateAccountRequest;
import com.moneysnapshot.account.web.SavingsContributionSettingRequest;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final BankRepository bankRepository;
    private final NameNormalizationService normalizer;
    private final ApplicationEventPublisher eventPublisher;
    private final CurrentUserService currentUserService;

    public AccountService(
            AccountRepository accountRepository,
            BankRepository bankRepository,
            NameNormalizationService normalizer,
            ApplicationEventPublisher eventPublisher,
            CurrentUserService currentUserService
    ) {
        this.accountRepository = accountRepository;
        this.bankRepository = bankRepository;
        this.normalizer = normalizer;
        this.eventPublisher = eventPublisher;
        this.currentUserService = currentUserService;
    }

    public List<Account> listAccounts() {
        return accountRepository.findAllByOwnerIdWithBankOrderByName(currentUserService.currentUserId());
    }

    public Account getAccount(UUID id) {
        return accountRepository.findByIdAndOwnerIdWithBank(id, currentUserService.currentUserId())
                .orElseThrow(() -> new AccountNotFoundException(id));
    }

    @Transactional
    public Account createAccount(CreateAccountRequest request) {
        String normalizedAccountName = normalizer.normalize(request.accountName());
        AppUser owner = currentUserService.currentUser();
        if (accountRepository.existsByOwnerIdAndNormalizedName(owner.getId(), normalizedAccountName)) {
            throw new DuplicateAccountNameException(normalizedAccountName);
        }

        String normalizedBankName = normalizer.normalize(request.bankName());
        Bank bank = bankRepository.findByOwnerIdAndNormalizedName(owner.getId(), normalizedBankName)
                .orElseGet(() -> bankRepository.save(new Bank(owner, request.bankName().trim(), normalizedBankName)));

        AccountStatus status = request.status() == null ? AccountStatus.ACTIVE : request.status();
        Account account = new Account(
                bank,
                owner,
                request.accountName().trim(),
                normalizedAccountName,
                normalizeAccountTypeCode(request.accountTypeCode()),
                request.currencyCode().trim().toUpperCase(),
                normalizeDescription(request.description()),
                normalizeForecastedMonthlyContribution(request.forecastedMonthlyContribution()),
                status
        );

        return accountRepository.save(account);
    }

    @Transactional
    public Account updateAccount(UUID id, CreateAccountRequest request) {
        Account account = getAccount(id);
        AppUser owner = account.getOwner() == null ? currentUserService.currentUser() : account.getOwner();
        String normalizedAccountName = normalizer.normalize(request.accountName());
        accountRepository.findByOwnerIdAndNormalizedName(owner.getId(), normalizedAccountName)
                .filter(existingAccount -> !existingAccount.getId().equals(id))
                .ifPresent(existingAccount -> {
                    throw new DuplicateAccountNameException(normalizedAccountName);
                });

        String normalizedBankName = normalizer.normalize(request.bankName());
        Bank bank = bankRepository.findByOwnerIdAndNormalizedName(owner.getId(), normalizedBankName)
                .orElseGet(() -> bankRepository.save(new Bank(owner, request.bankName().trim(), normalizedBankName)));
        AccountStatus status = request.status() == null ? AccountStatus.ACTIVE : request.status();

        account.updateDetails(
                bank,
                request.accountName().trim(),
                normalizedAccountName,
                normalizeAccountTypeCode(request.accountTypeCode()),
                request.currencyCode().trim().toUpperCase(),
                normalizeDescription(request.description()),
                normalizeForecastedMonthlyContribution(request.forecastedMonthlyContribution()),
                status
        );

        return accountRepository.save(account);
    }

    @Transactional
    public void deleteAccount(UUID id) {
        getAccount(id);

        eventPublisher.publishEvent(new AccountDeletionRequestedEvent(id));
        accountRepository.deleteById(id);
        accountRepository.flush();
    }

    @Transactional
    public List<Account> updateForecastedMonthlyContributions(List<SavingsContributionSettingRequest> requests) {
        UUID ownerId = currentUserService.currentUserId();
        Map<UUID, SavingsContributionSettingRequest> requestsByAccountId = requests.stream()
                .collect(java.util.stream.Collectors.toMap(
                        SavingsContributionSettingRequest::accountId,
                        Function.identity(),
                        (left, right) -> right,
                        java.util.LinkedHashMap::new
                ));

        List<Account> accounts = accountRepository.findAllByOwnerIdWithBankOrderByName(ownerId);
        Map<UUID, Account> accountsById = accounts.stream()
                .collect(java.util.stream.Collectors.toMap(Account::getId, Function.identity()));

        requestsByAccountId.forEach((accountId, request) -> {
            Account account = accountsById.get(accountId);
            if (account == null) {
                throw new AccountNotFoundException(accountId);
            }

            account.updateForecastedMonthlyContribution(
                    normalizeForecastedMonthlyContribution(request.forecastedMonthlyContribution())
            );
        });

        return accountRepository.saveAll(accounts);
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }

        return description.trim();
    }

    private String normalizeAccountTypeCode(String accountTypeCode) {
        if (accountTypeCode == null || accountTypeCode.isBlank()) {
            return "BANK_ACCOUNT";
        }

        return accountTypeCode.trim().toUpperCase();
    }

    private BigDecimal normalizeForecastedMonthlyContribution(BigDecimal forecastedMonthlyContribution) {
        if (forecastedMonthlyContribution == null) {
            return null;
        }

        return forecastedMonthlyContribution.stripTrailingZeros().scale() < 0
                ? forecastedMonthlyContribution.setScale(0)
                : forecastedMonthlyContribution;
    }
}
