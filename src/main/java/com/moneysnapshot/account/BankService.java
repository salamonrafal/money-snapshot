package com.moneysnapshot.account;

import com.moneysnapshot.account.web.CreateBankRequest;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class BankService {

    private final BankRepository bankRepository;
    private final NameNormalizationService normalizer;
    private final ApplicationEventPublisher eventPublisher;
    private final CurrentUserService currentUserService;

    public BankService(
            BankRepository bankRepository,
            NameNormalizationService normalizer,
            ApplicationEventPublisher eventPublisher,
            CurrentUserService currentUserService
    ) {
        this.bankRepository = bankRepository;
        this.normalizer = normalizer;
        this.eventPublisher = eventPublisher;
        this.currentUserService = currentUserService;
    }

    public List<Bank> listBanks() {
        return bankRepository.findAllByOwnerIdOrderByName(currentUserService.currentUserId());
    }

    @Transactional
    public Bank createBank(CreateBankRequest request) {
        String normalizedName = normalizer.normalize(request.name());
        AppUser owner = currentUserService.currentUser();
        if (bankRepository.findByOwnerIdAndNormalizedName(owner.getId(), normalizedName).isPresent()) {
            throw new DuplicateBankNameException(normalizedName);
        }

        return bankRepository.save(new Bank(owner, request.name().trim(), normalizedName));
    }

    @Transactional
    public void deleteBank(UUID id) {
        bankRepository.findByIdAndOwnerId(id, currentUserService.currentUserId())
                .orElseThrow(() -> new BankNotFoundException(id));

        eventPublisher.publishEvent(new BankDeletionRequestedEvent(id));
        bankRepository.deleteById(id);
        bankRepository.flush();
    }
}
