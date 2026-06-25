package com.moneysnapshot.account;

import com.moneysnapshot.account.web.CreateAccountRequest;
import com.moneysnapshot.account.web.SavingsContributionSettingRequest;
import com.moneysnapshot.bill.BillRepository;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import com.moneysnapshot.shared.validation.BankAccountNumbers;
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
    private final BillRepository billRepository;
    private final NameNormalizationService normalizer;
    private final ApplicationEventPublisher eventPublisher;
    private final CurrentUserService currentUserService;

    public AccountService(
            AccountRepository accountRepository,
            BankRepository bankRepository,
            BillRepository billRepository,
            NameNormalizationService normalizer,
            ApplicationEventPublisher eventPublisher,
            CurrentUserService currentUserService
    ) {
        this.accountRepository = accountRepository;
        this.bankRepository = bankRepository;
        this.billRepository = billRepository;
        this.normalizer = normalizer;
        this.eventPublisher = eventPublisher;
        this.currentUserService = currentUserService;
    }

    public List<Account> listAccounts() {
        return accountRepository.findAllByOwnerIdWithBankOrderByName(currentUserService.currentUserId());
    }

    public List<Account> listAccountsVisibleInSnapshots() {
        return listAccounts().stream()
                .filter(Account::isShowInSnapshots)
                .toList();
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
                normalizeBankAccountNumber(request.bankAccountNumber()),
                normalizeForecastedMonthlyContribution(request.forecastedMonthlyContribution()),
                normalizeShowInSnapshots(request.showInSnapshots(), true),
                status
        );

        Account savedAccount = accountRepository.save(account);
        eventPublisher.publishEvent(new AccountChangedEvent(owner.getId()));
        return savedAccount;
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
        BigDecimal forecastedMonthlyContribution = request.forecastedMonthlyContribution() == null
                ? account.getForecastedMonthlyContribution()
                : normalizeForecastedMonthlyContribution(request.forecastedMonthlyContribution());
        String bankAccountNumber = normalizeBankAccountNumber(request.bankAccountNumber());
        boolean showInSnapshots = normalizeShowInSnapshots(request.showInSnapshots(), account.isShowInSnapshots());
        String nextCurrencyCode = request.currencyCode().trim().toUpperCase();
        boolean currencyChanged = !account.getCurrencyCode().equals(nextCurrencyCode);

        account.updateDetails(
                bank,
                request.accountName().trim(),
                normalizedAccountName,
                normalizeAccountTypeCode(request.accountTypeCode()),
                nextCurrencyCode,
                normalizeDescription(request.description()),
                bankAccountNumber,
                forecastedMonthlyContribution,
                showInSnapshots,
                status
        );

        Account savedAccount = accountRepository.save(account);
        if (currencyChanged) {
            eventPublisher.publishEvent(new AccountCurrencyChangedEvent(savedAccount.getId(), nextCurrencyCode));
        }
        eventPublisher.publishEvent(new AccountChangedEvent(owner.getId()));
        return savedAccount;
    }

    @Transactional
    public void deleteAccount(UUID id) {
        Account account = getAccount(id);
        if (billRepository.existsByAccountIdAndOwnerId(id, account.getOwner().getId())) {
            throw new AccountInUseException(id);
        }

        eventPublisher.publishEvent(new AccountDeletionRequestedEvent(id));
        eventPublisher.publishEvent(new AccountChangedEvent(account.getOwner().getId()));
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

        eventPublisher.publishEvent(new AccountChangedEvent(ownerId));
        return accounts;
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

    private String normalizeBankAccountNumber(String bankAccountNumber) {
        if (bankAccountNumber == null || bankAccountNumber.isBlank()) {
            return null;
        }

        return BankAccountNumbers.normalize(bankAccountNumber);
    }

    private boolean normalizeShowInSnapshots(Boolean showInSnapshots, boolean fallbackValue) {
        return showInSnapshots == null ? fallbackValue : showInSnapshots;
    }
}
