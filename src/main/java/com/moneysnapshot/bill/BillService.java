package com.moneysnapshot.bill;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountRepository;
import com.moneysnapshot.bill.web.CreateBillRequest;
import com.moneysnapshot.counterparty.Counterparty;
import com.moneysnapshot.counterparty.CounterpartyRepository;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BillService {

    private final BillRepository billRepository;
    private final BillScheduleEntryRepository billScheduleEntryRepository;
    private final AccountRepository accountRepository;
    private final CounterpartyRepository counterpartyRepository;
    private final NameNormalizationService normalizer;
    private final CurrentUserService currentUserService;
    private final ApplicationEventPublisher eventPublisher;

    public BillService(
            BillRepository billRepository,
            BillScheduleEntryRepository billScheduleEntryRepository,
            AccountRepository accountRepository,
            CounterpartyRepository counterpartyRepository,
            NameNormalizationService normalizer,
            CurrentUserService currentUserService,
            ApplicationEventPublisher eventPublisher
    ) {
        this.billRepository = billRepository;
        this.billScheduleEntryRepository = billScheduleEntryRepository;
        this.accountRepository = accountRepository;
        this.counterpartyRepository = counterpartyRepository;
        this.normalizer = normalizer;
        this.currentUserService = currentUserService;
        this.eventPublisher = eventPublisher;
    }

    public List<Bill> listBills() {
        return billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(currentUserService.currentUserId());
    }

    public Bill getBill(UUID id) {
        return billRepository.findByIdAndOwnerId(id, currentUserService.currentUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found."));
    }

    @Transactional
    public Bill createBill(CreateBillRequest request) {
        validateRequest(request);
        AppUser owner = currentUserService.currentUser();
        String normalizedName = normalizer.normalize(request.name());
        if (billRepository.findByOwnerIdAndNormalizedName(owner.getId(), normalizedName).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bill with the same name already exists.");
        }

        Account account = accountRepository.findByIdAndOwnerIdWithBank(request.accountId(), owner.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found."));
        Counterparty counterparty = counterpartyRepository.findByIdAndOwnerId(request.counterpartyId(), owner.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Counterparty not found."));

        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                request.name().trim(),
                normalizedName,
                account.getCurrencyCode(),
                normalizeAmount(request.amount()),
                request.durationType(),
                request.durationType() == BillDurationType.UNTIL_DATE ? request.endDate() : null,
                request.durationType() == BillDurationType.INSTALLMENTS ? request.installmentCount() : null,
                request.repaymentDay(),
                request.startFrom(),
                request.status()
        );

        Bill saved = billRepository.save(bill);
        billRepository.flush();
        eventPublisher.publishEvent(new BillScheduleRegenerationRequestedEvent(saved.getId(), false));
        return saved;
    }

    @Transactional
    public Bill updateBill(UUID id, CreateBillRequest request) {
        validateRequest(request);
        UUID ownerId = currentUserService.currentUserId();
        Bill bill = getBill(id);
        String normalizedName = normalizer.normalize(request.name());
        billRepository.findByOwnerIdAndNormalizedName(ownerId, normalizedName)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Bill with the same name already exists.");
                });

        Account account = accountRepository.findByIdAndOwnerIdWithBank(request.accountId(), ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found."));
        Counterparty counterparty = counterpartyRepository.findByIdAndOwnerId(request.counterpartyId(), ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Counterparty not found."));
        boolean scheduleRegenerationRequired = scheduleRegenerationRequired(bill, request, account);

        bill.updateDetails(
                counterparty,
                account,
                request.name().trim(),
                normalizedName,
                account.getCurrencyCode(),
                normalizeAmount(request.amount()),
                request.durationType(),
                request.durationType() == BillDurationType.UNTIL_DATE ? request.endDate() : null,
                request.durationType() == BillDurationType.INSTALLMENTS ? request.installmentCount() : null,
                request.repaymentDay(),
                request.startFrom(),
                request.status()
        );

        Bill saved = billRepository.save(bill);
        billRepository.flush();
        if (scheduleRegenerationRequired) {
            eventPublisher.publishEvent(new BillScheduleRegenerationRequestedEvent(saved.getId(), true));
        }
        return saved;
    }

    @Transactional
    public void deleteBill(UUID id) {
        Bill bill = getBill(id);
        billScheduleEntryRepository.deleteByBillId(bill.getId());
        billRepository.delete(bill);
        billRepository.flush();
    }

    private void validateRequest(CreateBillRequest request) {
        if (request.amount() == null || request.amount().signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be greater than zero.");
        }

        if (request.repaymentDay() == null || request.repaymentDay() < 1 || request.repaymentDay() > 31) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Repayment day must be between 1 and 31.");
        }

        if (request.durationType() == BillDurationType.UNTIL_DATE && request.endDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date is required for fixed-date bills.");
        }

        if (request.durationType() == BillDurationType.UNTIL_DATE
                && request.endDate() != null
                && request.endDate().isBefore(request.startFrom())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be on or after start date.");
        }

        if (request.durationType() == BillDurationType.UNTIL_DATE
                && request.endDate() != null
                && exceedsFixedDateGenerationWindow(request.startFrom(), request.endDate(), request.repaymentDay())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fixed-date bills cannot span more than 600 scheduled months.");
        }

        if (request.durationType() == BillDurationType.INSTALLMENTS
                && (request.installmentCount() == null || request.installmentCount() < 1)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Installment count must be greater than zero.");
        }

        if (request.durationType() == BillDurationType.INSTALLMENTS
                && request.installmentCount() != null
                && request.installmentCount() > BillScheduleService.MAX_GENERATION_MONTHS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Installment count cannot exceed 600.");
        }
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        return amount.stripTrailingZeros().scale() < 0 ? amount.setScale(0) : amount;
    }

    private boolean scheduleRegenerationRequired(Bill bill, CreateBillRequest request, Account account) {
        BigDecimal normalizedAmount = normalizeAmount(request.amount());
        LocalDate nextEndDate = request.durationType() == BillDurationType.UNTIL_DATE ? request.endDate() : null;
        Integer nextInstallmentCount = request.durationType() == BillDurationType.INSTALLMENTS ? request.installmentCount() : null;

        return differsNumerically(bill.getAmount(), normalizedAmount)
                || bill.getDurationType() != request.durationType()
                || !Objects.equals(bill.getEndDate(), nextEndDate)
                || !Objects.equals(bill.getInstallmentCount(), nextInstallmentCount)
                || !Objects.equals(bill.getRepaymentDay(), request.repaymentDay())
                || !Objects.equals(bill.getStartFrom(), request.startFrom())
                || !Objects.equals(bill.getCurrencyCode(), account.getCurrencyCode())
                || requiresScheduleStatusRefresh(bill.getStatus(), request.status());
    }

    private boolean differsNumerically(BigDecimal currentValue, BigDecimal nextValue) {
        if (currentValue == null || nextValue == null) {
            return !Objects.equals(currentValue, nextValue);
        }

        return currentValue.compareTo(nextValue) != 0;
    }

    private boolean requiresScheduleStatusRefresh(BillStatus currentStatus, BillStatus nextStatus) {
        return currentStatus != nextStatus
                && (currentStatus == BillStatus.COMPLETED || nextStatus == BillStatus.COMPLETED);
    }

    private boolean exceedsFixedDateGenerationWindow(LocalDate startFrom, LocalDate endDate, Integer repaymentDay) {
        if (startFrom == null || endDate == null || repaymentDay == null) {
            return false;
        }

        int generatedEntries = 0;
        for (int monthOffset = 0; ; monthOffset += 1) {
            LocalDate dueDate = dueDateForMonth(startFrom, monthOffset, repaymentDay);
            if (dueDate.isBefore(startFrom)) {
                continue;
            }
            if (dueDate.isAfter(endDate)) {
                break;
            }

            generatedEntries += 1;
            if (generatedEntries > BillScheduleService.MAX_GENERATION_MONTHS) {
                return true;
            }
        }

        return false;
    }

    private LocalDate dueDateForMonth(LocalDate startFrom, int monthOffset, int repaymentDay) {
        LocalDate candidate = startFrom.withDayOfMonth(1).plusMonths(monthOffset);
        int lastDayOfMonth = candidate.lengthOfMonth();
        return candidate.withDayOfMonth(Math.min(repaymentDay, lastDayOfMonth));
    }
}
