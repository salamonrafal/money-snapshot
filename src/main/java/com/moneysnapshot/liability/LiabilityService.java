package com.moneysnapshot.liability;

import com.moneysnapshot.account.Bank;
import com.moneysnapshot.account.BankRepository;
import com.moneysnapshot.liability.web.CreateLiabilityRequest;
import com.moneysnapshot.liability.web.LiabilityDashboardResponse;
import com.moneysnapshot.liability.web.LiabilityRepaymentResponse;
import com.moneysnapshot.liability.web.LiabilityResponse;
import com.moneysnapshot.liability.web.LiabilitySummaryResponse;
import com.moneysnapshot.liability.web.RegisterLiabilityRepaymentRequest;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.shared.normalization.NameNormalizationService;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LiabilityService {

    private final LiabilityRepository liabilityRepository;
    private final LiabilityRepaymentRepository liabilityRepaymentRepository;
    private final BankRepository bankRepository;
    private final NameNormalizationService normalizer;
    private final CurrentUserService currentUserService;
    private final UserSettingsService userSettingsService;
    private final Clock clock;

    @Autowired
    public LiabilityService(
            LiabilityRepository liabilityRepository,
            LiabilityRepaymentRepository liabilityRepaymentRepository,
            BankRepository bankRepository,
            NameNormalizationService normalizer,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService
    ) {
        this(liabilityRepository, liabilityRepaymentRepository, bankRepository, normalizer, currentUserService, userSettingsService, Clock.systemUTC());
    }

    LiabilityService(
            LiabilityRepository liabilityRepository,
            LiabilityRepaymentRepository liabilityRepaymentRepository,
            BankRepository bankRepository,
            NameNormalizationService normalizer,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService,
            Clock clock
    ) {
        this.liabilityRepository = liabilityRepository;
        this.liabilityRepaymentRepository = liabilityRepaymentRepository;
        this.bankRepository = bankRepository;
        this.normalizer = normalizer;
        this.currentUserService = currentUserService;
        this.userSettingsService = userSettingsService;
        this.clock = clock;
    }

    public LiabilityDashboardResponse listDashboard() {
        UUID ownerId = currentUserService.currentUserId();
        return buildDashboard(ownerId);
    }

    public LiabilitySummaryResponse getSummary() {
        UUID ownerId = currentUserService.currentUserId();
        List<Liability> liabilities = liabilityRepository.findAllByOwnerIdOrderByBankNameAndName(ownerId);
        return buildSummary(liabilities);
    }

    private LiabilityDashboardResponse buildDashboard(UUID ownerId) {
        List<Liability> liabilities = liabilityRepository.findAllByOwnerIdOrderByBankNameAndName(ownerId);
        List<LiabilityRepayment> repayments = liabilityRepaymentRepository.findAllByOwnerIdOrderByLiabilityNameAndRepaymentDateDesc(ownerId);
        Map<UUID, List<LiabilityRepaymentResponse>> repaymentsByLiabilityId = repayments.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        repayment -> repayment.getLiability().getId(),
                        LinkedHashMap::new,
                        java.util.stream.Collectors.mapping(LiabilityRepaymentResponse::from, java.util.stream.Collectors.toList())
                ));

        List<LiabilityResponse> liabilityResponses = liabilities.stream()
                .map(liability -> LiabilityResponse.from(
                        liability,
                        repaymentsByLiabilityId.getOrDefault(liability.getId(), List.of())
                ))
                .toList();

        return new LiabilityDashboardResponse(buildSummary(liabilities), liabilityResponses);
    }

    public LiabilityResponse getLiabilityResponse(UUID id) {
        Liability liability = getLiability(id);
        return LiabilityResponse.from(liability, getLiabilityRepaymentResponses(id));
    }

    public List<LiabilityRepaymentResponse> getLiabilityRepaymentResponses(UUID liabilityId) {
        return liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateDesc(liabilityId).stream()
                .map(LiabilityRepaymentResponse::from)
                .toList();
    }

    public LiabilityRepaymentResponse getLiabilityRepaymentResponse(UUID repaymentId) {
        LiabilityRepayment repayment = getLiabilityRepayment(repaymentId);
        return LiabilityRepaymentResponse.from(repayment);
    }

    public Liability getLiability(UUID id) {
        return liabilityRepository.findByIdAndOwnerId(id, currentUserService.currentUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Liability not found."));
    }

    @Transactional
    public Liability createLiability(CreateLiabilityRequest request) {
        validateCreateRequest(request);
        AppUser owner = currentUserService.currentUser();
        String normalizedName = normalizedName(request.name());
        ensureUniqueLiabilityName(owner.getId(), normalizedName, null);

        LiabilityFields fields = resolveLiabilityFields(request, null);
        Liability saved = liabilityRepository.save(new Liability(
                fields.bank(),
                owner,
                request.name().trim(),
                normalizedName,
                fields.type(),
                userSettingsService.currentUserSettings().defaultCurrency(),
                fields.originalAmount(),
                fields.currentAmount(),
                fields.installmentAmount(),
                fields.creditCardLimit(),
                fields.creditCardMinimumPayment(),
                request.repaymentStartDate(),
                request.endDate(),
                fields.installmentCount(),
                fields.firstRepaymentDay(),
                fields.scheduleMode(),
                normalizeNote(request.note()),
                fields.status()
        ));

        return saved;
    }

    @Transactional
    public Liability updateLiability(UUID id, CreateLiabilityRequest request) {
        validateCreateRequest(request);
        Liability liability = getLiability(id);
        AppUser owner = currentUserService.currentUser();
        String normalizedName = normalizedName(request.name());
        ensureUniqueLiabilityName(owner.getId(), normalizedName, id);

        LiabilityFields fields = resolveLiabilityFields(request, liability);
        BigDecimal requestedCurrentAmount = fields.currentAmount();
        liability.updateDetails(
                fields.bank(),
                request.name().trim(),
                normalizedName,
                fields.type(),
                liability.getCurrencyCode(),
                fields.originalAmount(),
                fields.currentAmount(),
                fields.installmentAmount(),
                fields.creditCardLimit(),
                fields.creditCardMinimumPayment(),
                request.repaymentStartDate(),
                request.endDate(),
                fields.installmentCount(),
                fields.firstRepaymentDay(),
                fields.scheduleMode(),
                normalizeNote(request.note()),
                fields.status()
        );
        reconcileCurrentAmountAfterLiabilityUpdate(liability, requestedCurrentAmount);
        liabilityRepository.save(liability);
        return liability;
    }

    @Transactional
    public LiabilityRepayment registerRepayment(UUID liabilityId, RegisterLiabilityRepaymentRequest request) {
        validateRepaymentRequest(request);
        Liability liability = getLiability(liabilityId);
        requireActiveLiability(liability);
        List<LiabilityRepayment> repayments = new ArrayList<>(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liability.getId()));
        BigDecimal replayStartingBalance = resolveRepaymentReplayStartingBalance(liability, repayments);
        LiabilityRepayment repayment = liabilityRepaymentRepository.save(new LiabilityRepayment(
                liability,
                currentUserService.currentUser(),
                request.repaymentDate(),
                replayStartingBalance,
                BigDecimal.ZERO,
                normalizeNote(request.note())
        ));

        repayments.add(repayment);
        replayRepayments(liability, repayments, repayment, request, replayStartingBalance);
        liabilityRepository.save(liability);
        return repayment;
    }

    @Transactional
    public LiabilityRepayment updateRepayment(UUID repaymentId, RegisterLiabilityRepaymentRequest request) {
        validateRepaymentRequest(request);
        LiabilityRepayment targetRepayment = getLiabilityRepayment(repaymentId);
        Liability liability = targetRepayment.getLiability();
        requireActiveLiability(liability);
        List<LiabilityRepayment> repayments = new ArrayList<>(liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liability.getId()));
        BigDecimal replayStartingBalance = resolveRepaymentReplayStartingBalance(liability, repayments);
        replayRepayments(liability, repayments, targetRepayment, request, replayStartingBalance);
        liabilityRepository.save(liability);
        return targetRepayment;
    }

    @Transactional
    public void deleteRepayment(UUID repaymentId) {
        LiabilityRepayment targetRepayment = getLiabilityRepayment(repaymentId);
        Liability liability = targetRepayment.getLiability();
        List<LiabilityRepayment> existingRepayments = liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liability.getId());
        BigDecimal replayStartingBalance = resolveRepaymentReplayStartingBalance(liability, existingRepayments);

        liabilityRepaymentRepository.delete(targetRepayment);
        liabilityRepaymentRepository.flush();

        List<LiabilityRepayment> remainingRepayments = liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liability.getId());
        recalculateLiabilityCurrentAmount(liability, remainingRepayments, replayStartingBalance);

        liabilityRepository.save(liability);
    }

    @Transactional
    public void deleteLiability(UUID id) {
        Liability liability = getLiability(id);
        liabilityRepository.delete(liability);
    }

    @Transactional
    public void deleteAllByOwnerId(UUID ownerId) {
        liabilityRepaymentRepository.deleteByOwnerId(ownerId);
        liabilityRepository.deleteByOwnerId(ownerId);
    }

    private LiabilitySummaryResponse buildSummary(List<Liability> liabilities) {
        LocalDate today = LocalDate.now(clock);

        int activeCount = (int) liabilities.stream()
                .filter(liability -> liability.getStatus() == LiabilityStatus.ACTIVE)
                .count();

        BigDecimal currentDebt = liabilities.stream()
                .filter(liability -> liability.getStatus() == LiabilityStatus.ACTIVE)
                .map(Liability::getCurrentAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal monthlyDue = liabilities.stream()
                .filter(liability -> liability.getStatus() == LiabilityStatus.ACTIVE)
                .map(this::recurringMonthlyAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDate nextPaymentDate = liabilities.stream()
                .filter(liability -> liability.getStatus() == LiabilityStatus.ACTIVE)
                .map(liability -> resolveNextPaymentDate(liability, today))
                .filter(java.util.Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);

        return new LiabilitySummaryResponse(activeCount, monthlyDue, currentDebt, nextPaymentDate);
    }

    private LocalDate resolveNextPaymentDate(Liability liability, LocalDate today) {
        LocalDate repaymentStartDate = liability.getRepaymentStartDate();
        Integer firstRepaymentDay = liability.getFirstRepaymentDay();

        if (repaymentStartDate == null && firstRepaymentDay == null) {
            return null;
        }

        int repaymentDay = firstRepaymentDay != null
                ? normalizeDayOfMonth(firstRepaymentDay)
                : repaymentStartDate.getDayOfMonth();
        LocalDate earliestAllowedDate = repaymentStartDate != null && today.isBefore(repaymentStartDate)
                ? repaymentStartDate
                : today;

        return resolveNextMonthlyDate(earliestAllowedDate, repaymentDay);
    }

    private LocalDate resolveNextMonthlyDate(LocalDate earliestAllowedDate, int repaymentDay) {
        LocalDate currentMonthDate = earliestAllowedDate.withDayOfMonth(Math.min(repaymentDay, earliestAllowedDate.lengthOfMonth()));
        if (!currentMonthDate.isBefore(earliestAllowedDate)) {
            return currentMonthDate;
        }

        LocalDate nextMonth = earliestAllowedDate.plusMonths(1);
        return nextMonth.withDayOfMonth(Math.min(repaymentDay, nextMonth.lengthOfMonth()));
    }

    private BigDecimal recurringMonthlyAmount(Liability liability) {
        if (liability.getLiabilityTypeCode() == LiabilityTypeCode.CREDIT_CARD) {
            return liability.getCreditCardMinimumPayment() == null ? BigDecimal.ZERO : liability.getCreditCardMinimumPayment();
        }

        if (EnumSet.of(LiabilityTypeCode.LEASING, LiabilityTypeCode.INSTALLMENTS, LiabilityTypeCode.MORTGAGE, LiabilityTypeCode.CONSUMER_LOAN, LiabilityTypeCode.OTHER)
                .contains(liability.getLiabilityTypeCode())) {
            if (liability.getInstallmentAmount() != null) {
                return liability.getInstallmentAmount();
            }
        }

        return BigDecimal.ZERO;
    }

    private Bank resolveBank(AppUser owner, String bankName) {
        String normalizedBankName = normalizer.normalize(bankName);
        return bankRepository.findByOwnerIdAndNormalizedName(owner.getId(), normalizedBankName)
                .orElseGet(() -> bankRepository.save(new Bank(owner, bankName.trim(), normalizedBankName)));
    }

    private LiabilityScheduleMode resolveScheduleMode(LiabilityTypeCode type, LiabilityScheduleMode scheduleMode) {
        if (type == LiabilityTypeCode.LEASING || type == LiabilityTypeCode.INSTALLMENTS) {
            return LiabilityScheduleMode.INSTALLMENTS;
        }

        if (type == LiabilityTypeCode.MORTGAGE || type == LiabilityTypeCode.CONSUMER_LOAN) {
            return LiabilityScheduleMode.END_DATE;
        }

        if (type == LiabilityTypeCode.OTHER) {
            return scheduleMode == null ? LiabilityScheduleMode.END_DATE : scheduleMode;
        }

        return scheduleMode;
    }

    private BigDecimal resolveCurrentAmount(CreateLiabilityRequest request) {
        if (request.liabilityTypeCode() == LiabilityTypeCode.CREDIT_CARD) {
            return request.currentAmount() == null ? BigDecimal.ZERO : request.currentAmount();
        }

        if (request.currentAmount() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current amount is required.");
        }

        return request.currentAmount();
    }

    private BigDecimal resolveOriginalAmount(CreateLiabilityRequest request, BigDecimal currentAmount) {
        if (request.liabilityTypeCode() == LiabilityTypeCode.CREDIT_CARD) {
            if (request.creditCardLimit() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Credit card limit is required.");
            }

            return request.creditCardLimit();
        }

        return currentAmount;
    }

    private LiabilityFields resolveLiabilityFields(CreateLiabilityRequest request, Liability existingLiability) {
        AppUser owner = currentUserService.currentUser();
        Bank bank = resolveBank(owner, request.bankName());
        LiabilityTypeCode type = request.liabilityTypeCode();
        LiabilityScheduleMode scheduleMode = resolveScheduleMode(type, request.scheduleMode());
        Integer firstRepaymentDay = resolveFirstRepaymentDay(request.firstRepaymentDay(), request.repaymentStartDate());
        Integer installmentCount = normalizePositiveInteger(request.installmentCount());
        LiabilityStatus status = request.status() == null ? LiabilityStatus.ACTIVE : request.status();

        BigDecimal currentAmount;
        BigDecimal originalAmount;
        BigDecimal installmentAmount;
        BigDecimal creditCardLimit;
        BigDecimal creditCardMinimumPayment;

        if (type == LiabilityTypeCode.CREDIT_CARD) {
            creditCardLimit = normalizeMoney(request.creditCardLimit());
            creditCardMinimumPayment = normalizeMoney(request.creditCardMinimumPayment());
            if (existingLiability == null) {
                currentAmount = normalizeMoney(resolveCurrentAmount(request));
                originalAmount = normalizeMoney(resolveOriginalAmount(request, currentAmount));
            } else {
                currentAmount = request.currentAmount() == null
                        ? normalizeMoney(existingLiability.getCurrentAmount())
                        : normalizeMoney(request.currentAmount());
                originalAmount = creditCardLimit == null
                        ? normalizeMoney(existingLiability.getOriginalAmount())
                        : creditCardLimit;
            }
            installmentAmount = null;
        } else {
            currentAmount = normalizeMoney(resolveCurrentAmount(request));
            originalAmount = existingLiability == null
                    ? normalizeMoney(resolveOriginalAmount(request, currentAmount))
                    : normalizeMoney(existingLiability.getOriginalAmount());
            installmentAmount = normalizeMoney(request.installmentAmount());
            creditCardLimit = null;
            creditCardMinimumPayment = null;
        }

        return new LiabilityFields(
                bank,
                type,
                originalAmount,
                currentAmount,
                installmentAmount,
                creditCardLimit,
                creditCardMinimumPayment,
                installmentCount,
                firstRepaymentDay,
                scheduleMode,
                status
        );
    }

    private String normalizedName(String name) {
        return normalizer.normalize(name);
    }

    private void ensureUniqueLiabilityName(UUID ownerId, String normalizedName, UUID selfId) {
        if (selfId == null) {
            liabilityRepository.findByOwnerIdAndNormalizedName(ownerId, normalizedName)
                    .ifPresent(existing -> {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "Liability with this name already exists.");
                    });
            return;
        }

        liabilityRepository.findByOwnerIdAndNormalizedNameAndIdNot(ownerId, normalizedName, selfId)
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Liability with this name already exists.");
                });
    }

    private Integer resolveFirstRepaymentDay(Integer firstRepaymentDay, LocalDate repaymentStartDate) {
        if (firstRepaymentDay != null) {
            return normalizeDayOfMonth(firstRepaymentDay);
        }

        if (repaymentStartDate != null) {
            return repaymentStartDate.getDayOfMonth();
        }

        return null;
    }

    private Integer normalizePositiveInteger(Integer value) {
        if (value == null) {
            return null;
        }

        return value > 0 ? value : null;
    }

    private Integer normalizeDayOfMonth(Integer value) {
        if (value == null) {
            return null;
        }

        return Math.max(1, Math.min(31, value));
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        if (value == null) {
            return null;
        }

        return value.stripTrailingZeros().scale() < 0 ? value.setScale(0) : value;
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }

        return note.trim();
    }

    private void validateCreateRequest(CreateLiabilityRequest request) {
        if (request.name() == null || request.name().isBlank()
                || request.bankName() == null || request.bankName().isBlank()
                || request.liabilityTypeCode() == null
                || request.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
        }

        if (request.liabilityTypeCode() == LiabilityTypeCode.CREDIT_CARD) {
            if (request.creditCardLimit() == null || request.currentAmount() == null || request.creditCardMinimumPayment() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
            }
            if (isNegative(request.creditCardLimit()) || isNegative(request.currentAmount()) || isNegative(request.creditCardMinimumPayment())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
            }
            if (request.currentAmount().compareTo(request.creditCardLimit()) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Credit card current amount cannot exceed credit card limit.");
            }
            return;
        }

        if (request.currentAmount() == null || request.installmentAmount() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
        }
        if (isNegative(request.currentAmount()) || isNegative(request.installmentAmount())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
        }

        if ((request.liabilityTypeCode() == LiabilityTypeCode.MORTGAGE || request.liabilityTypeCode() == LiabilityTypeCode.CONSUMER_LOAN)
                && request.endDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
        }

        if ((request.liabilityTypeCode() == LiabilityTypeCode.LEASING || request.liabilityTypeCode() == LiabilityTypeCode.INSTALLMENTS)
                && !isPositive(request.installmentCount())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
        }

        if (request.liabilityTypeCode() == LiabilityTypeCode.OTHER) {
            if (request.scheduleMode() == LiabilityScheduleMode.END_DATE && request.endDate() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
            }
            if (request.scheduleMode() == LiabilityScheduleMode.INSTALLMENTS && !isPositive(request.installmentCount())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required liability fields are missing.");
            }
        }
    }

    private LiabilityRepayment getLiabilityRepayment(UUID repaymentId) {
        return liabilityRepaymentRepository.findByIdAndOwnerId(repaymentId, currentUserService.currentUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Repayment not found."));
    }

    private void recalculateLiabilityCurrentAmount(Liability liability, List<LiabilityRepayment> repayments, BigDecimal replayStartingBalance) {
        BigDecimal currentBalance = replayStartingBalance;
        for (LiabilityRepayment repayment : sortRepaymentsForReplay(repayments, null, null)) {
            currentBalance = normalizeMoney(currentBalance.subtract(normalizeMoney(repayment.getAmount())));
            repayment.updateCurrentAmount(currentBalance);
        }
        liability.updateCurrentAmount(currentBalance);
    }

    private void reconcileCurrentAmountAfterLiabilityUpdate(Liability liability, BigDecimal requestedCurrentAmount) {
        List<LiabilityRepayment> repayments = liabilityRepaymentRepository.findAllByLiabilityIdOrderByRepaymentDateAsc(liability.getId());
        if (repayments.isEmpty()) {
            return;
        }

        if (liability.getLiabilityTypeCode() == LiabilityTypeCode.CREDIT_CARD) {
            reconcileCreditCardRepaymentsToCurrentAmount(liability, repayments, requestedCurrentAmount);
            return;
        }

        recalculateLiabilityCurrentAmount(liability, repayments, normalizeMoney(liability.getOriginalAmount()));
    }

    private void reconcileCreditCardRepaymentsToCurrentAmount(
            Liability liability,
            List<LiabilityRepayment> repayments,
            BigDecimal requestedCurrentAmount
    ) {
        BigDecimal repaymentTotal = repayments.stream()
                .map(LiabilityRepayment::getAmount)
                .map(this::normalizeMoney)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal replayStartingBalance = normalizeMoney(requestedCurrentAmount).add(repaymentTotal);
        recalculateLiabilityCurrentAmount(liability, repayments, replayStartingBalance);
    }

    private void replayRepayments(
            Liability liability,
            List<LiabilityRepayment> repayments,
            LiabilityRepayment targetRepayment,
            RegisterLiabilityRepaymentRequest targetRequest,
            BigDecimal replayStartingBalance
    ) {
        BigDecimal currentBalance = replayStartingBalance;
        for (LiabilityRepayment repayment : sortRepaymentsForReplay(repayments, targetRepayment, targetRequest)) {
            if (sameRepayment(repayment, targetRepayment)) {
                RepaymentAmounts repaymentAmounts = resolveRepaymentAmounts(currentBalance, targetRequest);
                repayment.updateDetails(
                        targetRequest.repaymentDate(),
                        repaymentAmounts.currentAmount(),
                        repaymentAmounts.amount(),
                        normalizeNote(targetRequest.note())
                );
                currentBalance = repaymentAmounts.currentAmount();
                continue;
            }

            currentBalance = normalizeMoney(currentBalance.subtract(normalizeMoney(repayment.getAmount())));
            if (currentBalance.compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Repayment amount cannot exceed current liability amount.");
            }
            repayment.updateCurrentAmount(currentBalance);
        }

        liability.updateCurrentAmount(currentBalance);
    }

    private List<LiabilityRepayment> sortRepaymentsForReplay(
            List<LiabilityRepayment> repayments,
            LiabilityRepayment targetRepayment,
            RegisterLiabilityRepaymentRequest targetRequest
    ) {
        return repayments.stream()
                .sorted((left, right) -> compareRepaymentsForReplay(left, right, targetRepayment, targetRequest))
                .toList();
    }

    private int compareRepaymentsForReplay(
            LiabilityRepayment left,
            LiabilityRepayment right,
            LiabilityRepayment targetRepayment,
            RegisterLiabilityRepaymentRequest targetRequest
    ) {
        LocalDate leftDate = sameRepayment(left, targetRepayment) && targetRequest != null ? targetRequest.repaymentDate() : left.getRepaymentDate();
        LocalDate rightDate = sameRepayment(right, targetRepayment) && targetRequest != null ? targetRequest.repaymentDate() : right.getRepaymentDate();
        int dateComparison = leftDate.compareTo(rightDate);
        if (dateComparison != 0) {
            return dateComparison;
        }

        return Comparator
                .nullsLast(Comparator.<java.time.OffsetDateTime>naturalOrder())
                .compare(left.getCreatedAt(), right.getCreatedAt());
    }

    private boolean sameRepayment(LiabilityRepayment left, LiabilityRepayment right) {
        if (left == right) {
            return true;
        }

        return left != null && right != null && left.getId() != null && left.getId().equals(right.getId());
    }

    private BigDecimal resolveRepaymentReplayStartingBalance(Liability liability, List<LiabilityRepayment> repayments) {
        if (liability.getLiabilityTypeCode() != LiabilityTypeCode.CREDIT_CARD) {
            return normalizeMoney(liability.getOriginalAmount());
        }

        return repayments.stream()
                .min(Comparator
                        .comparing(LiabilityRepayment::getRepaymentDate)
                        .thenComparing(LiabilityRepayment::getCreatedAt))
                .map(repayment -> normalizeMoney(repayment.getCurrentAmount()).add(normalizeMoney(repayment.getAmount())))
                .orElseGet(() -> normalizeMoney(liability.getCurrentAmount()));
    }

    private RepaymentAmounts resolveRepaymentAmounts(BigDecimal baseCurrentAmount, RegisterLiabilityRepaymentRequest request) {
        BigDecimal sourceAmount = normalizeMoney(request.sourceAmount());

        if (baseCurrentAmount == null || sourceAmount == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required repayment fields are missing.");
        }

        if (sourceAmount.compareTo(baseCurrentAmount) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Repayment amount cannot exceed current liability amount.");
        }

        if (request.sourceType() == LiabilityRepaymentSourceType.CURRENT_AMOUNT) {
            BigDecimal currentAmount = sourceAmount;
            BigDecimal amount = normalizeMoney(baseCurrentAmount.subtract(currentAmount));
            return new RepaymentAmounts(currentAmount, amount);
        }

        BigDecimal amount = sourceAmount;
        BigDecimal currentAmount = normalizeMoney(baseCurrentAmount.subtract(amount));
        return new RepaymentAmounts(currentAmount, amount);
    }

    private void validateRepaymentRequest(RegisterLiabilityRepaymentRequest request) {
        if (request.repaymentDate() == null || request.sourceType() == null || request.sourceAmount() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required repayment fields are missing.");
        }

        if (isNegative(request.sourceAmount())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Required repayment fields are missing.");
        }
    }

    private void requireActiveLiability(Liability liability) {
        if (liability.getStatus() != LiabilityStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Repayments can only be registered for active liabilities.");
        }
    }

    private record RepaymentAmounts(BigDecimal currentAmount, BigDecimal amount) {
    }

    private boolean isNegative(BigDecimal value) {
        return value != null && value.compareTo(BigDecimal.ZERO) < 0;
    }

    private boolean isPositive(Integer value) {
        return value != null && value > 0;
    }

    private record LiabilityFields(
            Bank bank,
            LiabilityTypeCode type,
            BigDecimal originalAmount,
            BigDecimal currentAmount,
            BigDecimal installmentAmount,
            BigDecimal creditCardLimit,
            BigDecimal creditCardMinimumPayment,
            Integer installmentCount,
            Integer firstRepaymentDay,
            LiabilityScheduleMode scheduleMode,
            LiabilityStatus status
    ) {
    }
}
