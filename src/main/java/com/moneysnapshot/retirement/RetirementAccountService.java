package com.moneysnapshot.retirement;

import com.moneysnapshot.retirement.web.CreateRetirementAccountRequest;
import com.moneysnapshot.retirement.web.CreateRetirementAccountContributionRequest;
import com.moneysnapshot.retirement.web.UpdateRetirementAccountBalanceRequest;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class RetirementAccountService {

    private final RetirementAccountRepository retirementAccountRepository;
    private final RetirementAccountContributionRepository retirementAccountContributionRepository;
    private final CurrentUserService currentUserService;
    private final NameNormalizationService normalizer;

    public RetirementAccountService(
            RetirementAccountRepository retirementAccountRepository,
            RetirementAccountContributionRepository retirementAccountContributionRepository,
            CurrentUserService currentUserService,
            NameNormalizationService normalizer
    ) {
        this.retirementAccountRepository = retirementAccountRepository;
        this.retirementAccountContributionRepository = retirementAccountContributionRepository;
        this.currentUserService = currentUserService;
        this.normalizer = normalizer;
    }

    public List<RetirementAccount> listAccounts() {
        return retirementAccountRepository.findAllByOwnerIdOrderByName(currentUserService.currentUserId());
    }

    public RetirementAccount getAccount(UUID id) {
        return retirementAccountRepository.findByIdAndOwnerId(id, currentUserService.currentUserId())
                .orElseThrow(() -> new RetirementAccountNotFoundException(id));
    }

    public List<RetirementAccountContribution> listContributions() {
        return retirementAccountContributionRepository.findAllByOwnerIdOrderByContributionDateDesc(currentUserService.currentUserId());
    }

    public List<RetirementAccountContribution> listContributions(UUID accountId) {
        RetirementAccount account = getAccount(accountId);
        return retirementAccountContributionRepository.findAllByAccountIdAndOwnerIdOrderByContributionDateDesc(
                account.getId(),
                currentUserService.currentUserId()
        );
    }

    @Transactional
    public RetirementAccount createAccount(CreateRetirementAccountRequest request) {
        AppUser owner = currentUserService.currentUser();
        String normalizedName = normalizer.normalize(request.accountName());
        if (retirementAccountRepository.existsByOwnerIdAndNormalizedName(owner.getId(), normalizedName)) {
            throw new DuplicateRetirementAccountNameException(normalizedName);
        }

        RetirementAccount account = new RetirementAccount(
                owner,
                normalizeAccountTypeCode(request.accountTypeCode()),
                request.institution().trim(),
                request.accountName().trim(),
                normalizedName,
                normalizeWebsiteUrl(request.websiteUrl()),
                normalizeCurrencyCode(request.currencyCode()),
                normalizeAmount(request.balance()),
                normalizeMonthlyContribution(request.monthlyContribution()),
                request.balanceUpdatedAt(),
                normalizeStatus(request.status())
        );
        return retirementAccountRepository.save(account);
    }

    @Transactional
    public RetirementAccount updateAccount(UUID id, CreateRetirementAccountRequest request) {
        RetirementAccount account = getAccountForBalanceUpdate(id);
        UUID ownerId = account.getOwner().getId();
        String normalizedName = normalizer.normalize(request.accountName());
        retirementAccountRepository.findByOwnerIdAndNormalizedName(ownerId, normalizedName)
                .filter(existingAccount -> !existingAccount.getId().equals(id))
                .ifPresent(existingAccount -> {
                    throw new DuplicateRetirementAccountNameException(normalizedName);
                });

        account.updateDetails(
                normalizeAccountTypeCode(request.accountTypeCode()),
                request.institution().trim(),
                request.accountName().trim(),
                normalizedName,
                normalizeWebsiteUrl(request.websiteUrl()),
                normalizeMonthlyContribution(request.monthlyContribution()),
                normalizeStatus(request.status())
        );
        return retirementAccountRepository.save(account);
    }

    @Transactional
    public RetirementAccount updateBalance(UUID id, UpdateRetirementAccountBalanceRequest request) {
        RetirementAccount account = getAccountForBalanceUpdate(id);
        validateBalanceUpdatedAt(request.balanceUpdatedAt(), account);
        account.updateBalance(normalizeAmount(request.balance()), request.balanceUpdatedAt());
        return retirementAccountRepository.save(account);
    }

    @Transactional
    public RetirementAccountContribution registerContribution(UUID accountId, CreateRetirementAccountContributionRequest request) {
        RetirementAccount account = getAccountForBalanceUpdate(accountId);
        BigDecimal previousBalance = normalizeAmount(account.getBalance());
        BigDecimal currentBalance = normalizeAmount(request.currentBalance());
        BigDecimal amount = normalizeAmount(currentBalance.subtract(previousBalance));
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Current balance must be greater than the previous balance.");
        }
        validateBalanceUpdatedAt(request.contributionDate(), account);

        RetirementAccountContribution contribution = new RetirementAccountContribution(
                account.getOwner(),
                account,
                request.contributionDate(),
                amount,
                previousBalance,
                currentBalance,
                normalizeNote(request.note())
        );

        account.updateBalance(currentBalance, request.contributionDate());
        retirementAccountRepository.save(account);
        return retirementAccountContributionRepository.save(contribution);
    }

    private void validateBalanceUpdatedAt(LocalDate balanceUpdatedAt, RetirementAccount account) {
        if (balanceUpdatedAt.isBefore(account.getBalanceUpdatedAt())) {
            throw new IllegalArgumentException("Balance update date cannot be before the current balance update date.");
        }
    }

    private RetirementAccount getAccountForBalanceUpdate(UUID id) {
        return retirementAccountRepository.findByIdAndOwnerIdForUpdate(id, currentUserService.currentUserId())
                .orElseThrow(() -> new RetirementAccountNotFoundException(id));
    }

    @Transactional
    public void deleteAccount(UUID id) {
        RetirementAccount account = getAccount(id);
        retirementAccountRepository.delete(account);
        retirementAccountRepository.flush();
    }

    private String normalizeAccountTypeCode(String accountTypeCode) {
        return accountTypeCode.trim().toUpperCase();
    }

    private String normalizeCurrencyCode(String currencyCode) {
        if (currencyCode == null || currencyCode.isBlank()) {
            return "PLN";
        }
        return currencyCode.trim().toUpperCase();
    }

    private String normalizeWebsiteUrl(String websiteUrl) {
        if (websiteUrl == null || websiteUrl.isBlank()) {
            return null;
        }

        String normalizedUrl = websiteUrl.trim();
        if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
            normalizedUrl = "https://" + normalizedUrl;
        }

        try {
            URI uri = new URI(normalizedUrl);
            String scheme = uri.getScheme();
            if ((!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))
                    || uri.getHost() == null
                    || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("Website URL must be a valid http or https address.");
            }
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("Website URL must be a valid http or https address.", exception);
        }

        return normalizedUrl;
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        return amount.stripTrailingZeros().scale() < 0
                ? amount.setScale(0)
                : amount;
    }

    private BigDecimal normalizeMonthlyContribution(BigDecimal monthlyContribution) {
        return monthlyContribution == null ? BigDecimal.ZERO : normalizeAmount(monthlyContribution);
    }

    private RetirementAccountStatus normalizeStatus(RetirementAccountStatus status) {
        return status == null ? RetirementAccountStatus.ACTIVE : status;
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.trim();
    }
}
