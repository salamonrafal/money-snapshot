package com.moneysnapshot.counterparty;

import com.moneysnapshot.bill.BillRepository;
import com.moneysnapshot.counterparty.web.CreateCounterpartyRequest;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import com.moneysnapshot.shared.validation.BankAccountNumbers;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class CounterpartyService {

    private final CounterpartyRepository counterpartyRepository;
    private final BillRepository billRepository;
    private final NameNormalizationService normalizer;
    private final CurrentUserService currentUserService;

    public CounterpartyService(
            CounterpartyRepository counterpartyRepository,
            BillRepository billRepository,
            NameNormalizationService normalizer,
            CurrentUserService currentUserService
    ) {
        this.counterpartyRepository = counterpartyRepository;
        this.billRepository = billRepository;
        this.normalizer = normalizer;
        this.currentUserService = currentUserService;
    }

    public List<Counterparty> listCounterparties() {
        return counterpartyRepository.findAllByOwnerIdOrderByName(currentUserService.currentUserId());
    }

    public Counterparty getCounterparty(UUID id) {
        return counterpartyRepository.findByIdAndOwnerId(id, currentUserService.currentUserId())
                .orElseThrow(() -> new CounterpartyNotFoundException(id));
    }

    @Transactional
    public Counterparty createCounterparty(CreateCounterpartyRequest request) {
        String normalizedName = normalizer.normalize(request.name());
        AppUser owner = currentUserService.currentUser();
        if (counterpartyRepository.findByOwnerIdAndNormalizedName(owner.getId(), normalizedName).isPresent()) {
            throw new DuplicateCounterpartyNameException(normalizedName);
        }

        try {
            return counterpartyRepository.saveAndFlush(new Counterparty(
                    owner,
                    request.name().trim(),
                    normalizedName,
                    normalizeBankAccountNumber(request.bankAccountNumber()),
                    trimToNull(request.address()),
                    trimToNull(request.note())
            ));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateCounterpartyNameException(normalizedName);
        }
    }

    @Transactional
    public Counterparty updateCounterparty(UUID id, CreateCounterpartyRequest request) {
        Counterparty counterparty = getCounterparty(id);
        String normalizedName = normalizer.normalize(request.name());
        counterpartyRepository.findByOwnerIdAndNormalizedName(currentUserService.currentUserId(), normalizedName)
                .filter(existingCounterparty -> !existingCounterparty.getId().equals(id))
                .ifPresent(existingCounterparty -> {
                    throw new DuplicateCounterpartyNameException(normalizedName);
                });

        counterparty.updateDetails(
                request.name().trim(),
                normalizedName,
                normalizeBankAccountNumber(request.bankAccountNumber()),
                trimToNull(request.address()),
                trimToNull(request.note())
        );
        try {
            return counterpartyRepository.saveAndFlush(counterparty);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateCounterpartyNameException(normalizedName);
        }
    }

    @Transactional
    public void deleteCounterparty(UUID id) {
        Counterparty counterparty = getCounterparty(id);
        if (billRepository.existsByCounterpartyIdAndOwnerId(id, currentUserService.currentUserId())) {
            throw new CounterpartyInUseException(counterparty.getId());
        }
        counterpartyRepository.deleteById(id);
        counterpartyRepository.flush();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeBankAccountNumber(String value) {
        return BankAccountNumbers.normalize(value);
    }
}
