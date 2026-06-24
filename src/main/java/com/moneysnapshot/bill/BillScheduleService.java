package com.moneysnapshot.bill;

import com.moneysnapshot.bill.web.BillScheduleEntryResponse;
import com.moneysnapshot.bill.web.BillScheduleSummaryResponse;
import com.moneysnapshot.bill.web.PagedBillScheduleResponse;
import com.moneysnapshot.security.CurrentUserService;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BillScheduleService {

    private static final int OPEN_ENDED_SCHEDULE_LENGTH = 12;
    static final int MAX_GENERATION_MONTHS = 600;

    private final BillRepository billRepository;
    private final BillScheduleEntryRepository billScheduleEntryRepository;
    private final CurrentUserService currentUserService;
    private final Clock clock;

    @Autowired
    public BillScheduleService(
            BillRepository billRepository,
            BillScheduleEntryRepository billScheduleEntryRepository,
            CurrentUserService currentUserService
    ) {
        this(billRepository, billScheduleEntryRepository, currentUserService, Clock.systemDefaultZone());
    }

    BillScheduleService(
            BillRepository billRepository,
            BillScheduleEntryRepository billScheduleEntryRepository,
            CurrentUserService currentUserService,
            Clock clock
    ) {
        this.billRepository = billRepository;
        this.billScheduleEntryRepository = billScheduleEntryRepository;
        this.currentUserService = currentUserService;
        this.clock = clock;
    }

    @Transactional
    public void regenerateSchedule(UUID billId) {
        Bill bill = billRepository.findByIdWithAccountAndCounterparty(billId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found."));
        regenerateSchedule(bill, false);
    }

    @Transactional
    public void regenerateScheduleFromCurrentDate(UUID billId) {
        Bill bill = billRepository.findByIdWithAccountAndCounterparty(billId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found."));
        regenerateSchedule(bill, true);
    }

    @Transactional
    public PagedBillScheduleResponse listSchedule(UUID billId, Pageable pageable) {
        UUID ownerId = currentUserService.currentUserId();
        Bill bill = billRepository.findByIdAndOwnerId(billId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found."));
        LocalDate today = LocalDate.now(clock);
        long existingEntriesCount = billScheduleEntryRepository.countByBillId(billId);

        if (existingEntriesCount == 0) {
            if (bill.getDurationType() == BillDurationType.OPEN_ENDED) {
                appendOpenEndedScheduleEntries(bill, ownerId, today, OPEN_ENDED_SCHEDULE_LENGTH, true);
            } else {
                regenerateSchedule(bill, false);
            }
        } else if (bill.getDurationType() == BillDurationType.OPEN_ENDED
                && requiresOpenEndedScheduleExpansion(billId, ownerId, today, pageable)) {
            long upcomingEntriesCount = billScheduleEntryRepository.countByBillIdAndOwnerIdAndDueDateGreaterThanEqual(billId, ownerId, today);
            appendOpenEndedScheduleEntries(bill, ownerId, today, requiredOpenEndedExpansionCount(pageable, upcomingEntriesCount), false);
        }

        Page<BillScheduleEntryResponse> page = billScheduleEntryRepository
                .findVisiblePageByBillIdAndOwnerId(billId, ownerId, today, pageable)
                .map(BillScheduleEntryResponse::from);

        return PagedBillScheduleResponse.from(BillScheduleSummaryResponse.from(bill), page);
    }

    @Transactional
    public BillScheduleEntryResponse updatePaidStatus(UUID billId, UUID entryId, boolean paid) {
        UUID ownerId = currentUserService.currentUserId();
        billRepository.findByIdAndOwnerId(billId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found."));

        BillScheduleEntry entry = billScheduleEntryRepository.findByIdAndBillIdAndOwnerId(entryId, billId, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill schedule entry not found."));

        entry.setPaid(paid);
        return BillScheduleEntryResponse.from(billScheduleEntryRepository.save(entry));
    }

    private void regenerateSchedule(Bill bill, boolean fromCurrentDate) {
        LocalDate today = LocalDate.now(clock);
        if (!fromCurrentDate) {
            billScheduleEntryRepository.deleteByBillId(bill.getId());
            billScheduleEntryRepository.flush();
        } else if (bill.getStatus() == BillStatus.COMPLETED) {
            billScheduleEntryRepository.deleteByBillIdAndDueDateGreaterThanEqual(bill.getId(), today);
            billScheduleEntryRepository.flush();
        } else {
            billScheduleEntryRepository.deleteByBillIdAndDueDateGreaterThanEqualAndPaidFalse(bill.getId(), today);
            billScheduleEntryRepository.flush();
        }

        List<BillScheduleEntry> entries = buildScheduleEntries(bill, today, fromCurrentDate);
        if (fromCurrentDate && bill.getStatus() != BillStatus.COMPLETED) {
            entries = filterOutPreservedInstallments(bill, today, entries);
        }
        if (!entries.isEmpty()) {
            billScheduleEntryRepository.saveAll(entries);
        }
    }

    private List<BillScheduleEntry> filterOutPreservedInstallments(Bill bill, LocalDate today, List<BillScheduleEntry> entries) {
        Set<Integer> preservedInstallmentNumbers = billScheduleEntryRepository
                .findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(bill.getId())
                .stream()
                .filter(entry -> entry.isPaid() || entry.getDueDate().isBefore(today))
                .map(BillScheduleEntry::getInstallmentNumber)
                .collect(Collectors.toSet());

        if (preservedInstallmentNumbers.isEmpty()) {
            return entries;
        }

        return entries.stream()
                .filter(entry -> !preservedInstallmentNumbers.contains(entry.getInstallmentNumber()))
                .toList();
    }

    private boolean requiresOpenEndedScheduleExpansion(
            UUID billId,
            UUID ownerId,
            LocalDate today,
            Pageable pageable
    ) {
        // Current business rule: open-ended bills bootstrap only the initial 12
        // upcoming rows. We do not top up the first page as entries age out.
        // A later cleanup/refresh feature can change this behavior explicitly.
        if (pageable.getOffset() == 0) {
            return false;
        }
        long upcomingEntriesCount = billScheduleEntryRepository.countByBillIdAndOwnerIdAndDueDateGreaterThanEqual(billId, ownerId, today);
        long requiredEntriesCount = pageable.getOffset() + pageable.getPageSize();
        return upcomingEntriesCount < requiredEntriesCount;
    }

    private int requiredOpenEndedExpansionCount(Pageable pageable, long upcomingEntriesCount) {
        long requiredEntriesCount = pageable.getOffset() + pageable.getPageSize();
        long missingEntries = Math.max(requiredEntriesCount - upcomingEntriesCount, 0);
        return (int) Math.max(OPEN_ENDED_SCHEDULE_LENGTH, missingEntries);
    }

    private void appendOpenEndedScheduleEntries(Bill bill, UUID ownerId, LocalDate today, int entriesToGenerate, boolean bootstrap) {
        if (bill.getStatus() == BillStatus.COMPLETED) {
            return;
        }
        BillScheduleEntry lastEntry = billScheduleEntryRepository
                .findFirstByBillIdAndOwnerIdOrderByDueDateDescInstallmentNumberDesc(bill.getId(), ownerId)
                .orElse(null);
        if (bootstrap) {
            billRepository.findByIdAndOwnerIdForUpdate(bill.getId(), ownerId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bill not found."));
            if (billScheduleEntryRepository.countByBillId(bill.getId()) > 0) {
                return;
            }
        }
        int nextInstallmentNumber = lastEntry == null ? 1 : lastEntry.getInstallmentNumber() + 1;
        LocalDate referenceDate = lastEntry == null
                ? regenerationReferenceDate(bill, today)
                : lastEntry.getDueDate().plusDays(1);
        List<BillScheduleEntry> entries = buildOpenEndedScheduleEntriesFromReferenceDate(
                bill,
                today,
                referenceDate,
                nextInstallmentNumber,
                entriesToGenerate
        );
        if (!entries.isEmpty()) {
            billScheduleEntryRepository.saveAll(entries);
        }
    }

    private List<BillScheduleEntry> buildScheduleEntries(Bill bill, LocalDate today, boolean fromCurrentDate) {
        if (bill.getStatus() == BillStatus.COMPLETED) {
            return List.of();
        }

        return switch (bill.getDurationType()) {
            case INSTALLMENTS -> buildInstallmentScheduleEntries(bill, today, fromCurrentDate);
            case UNTIL_DATE -> buildUntilDateScheduleEntries(bill, today, fromCurrentDate);
            case OPEN_ENDED -> buildOpenEndedScheduleEntries(bill, today, fromCurrentDate);
        };
    }

    private List<BillScheduleEntry> buildInstallmentScheduleEntries(Bill bill, LocalDate today, boolean fromCurrentDate) {
        int installmentCount = Math.max(bill.getInstallmentCount() == null ? 0 : bill.getInstallmentCount(), 0);
        int installmentNumber = 1;
        LocalDate referenceDate = fromCurrentDate ? regenerationReferenceDate(bill, today) : bill.getStartFrom();
        if (fromCurrentDate) {
            installmentNumber = countScheduleEntriesBefore(bill, referenceDate) + 1;
        }
        List<BillScheduleEntry> entries = new ArrayList<>(Math.max(installmentCount - installmentNumber + 1, 0));

        for (int monthOffset = 0; installmentNumber <= installmentCount; monthOffset += 1) {
            LocalDate dueDate = dueDateForMonth(referenceDate, monthOffset, bill.getRepaymentDay());
            if (dueDate.isBefore(referenceDate)) {
                continue;
            }

            entries.add(createEntry(bill, installmentNumber, dueDate));
            installmentNumber += 1;
        }

        return entries;
    }

    private List<BillScheduleEntry> buildUntilDateScheduleEntries(Bill bill, LocalDate today, boolean fromCurrentDate) {
        if (bill.getEndDate() == null) {
            return List.of();
        }

        List<BillScheduleEntry> entries = new ArrayList<>();
        int installmentNumber = fromCurrentDate ? countScheduleEntriesBefore(bill, regenerationReferenceDate(bill, today)) + 1 : 1;
        LocalDate referenceDate = fromCurrentDate ? regenerationReferenceDate(bill, today) : bill.getStartFrom();

        for (int monthOffset = 0; ; monthOffset += 1) {
            LocalDate dueDate = dueDateForMonth(referenceDate, monthOffset, bill.getRepaymentDay());
            if (dueDate.isBefore(referenceDate)) {
                continue;
            }
            if (dueDate.isAfter(bill.getEndDate())) {
                break;
            }

            entries.add(createEntry(bill, installmentNumber, dueDate));
            installmentNumber += 1;
        }

        return entries;
    }

    private List<BillScheduleEntry> buildOpenEndedScheduleEntries(Bill bill, LocalDate today, boolean fromCurrentDate) {
        LocalDate referenceDate = fromCurrentDate ? regenerationReferenceDate(bill, today) : bill.getStartFrom();
        return buildOpenEndedScheduleEntriesFromReferenceDate(
                bill,
                today,
                referenceDate,
                fromCurrentDate ? countScheduleEntriesBefore(bill, referenceDate) + 1 : 1,
                OPEN_ENDED_SCHEDULE_LENGTH
        );
    }

    private List<BillScheduleEntry> buildOpenEndedScheduleEntriesFromReferenceDate(
            Bill bill,
            LocalDate today,
            LocalDate referenceDate,
            int startingInstallmentNumber,
            int entriesToGenerate
    ) {
        List<BillScheduleEntry> entries = new ArrayList<>(Math.max(entriesToGenerate, 0));
        int installmentNumber = startingInstallmentNumber;

        for (int monthOffset = 0; entries.size() < entriesToGenerate; monthOffset += 1) {
            LocalDate dueDate = dueDateForMonth(referenceDate, monthOffset, bill.getRepaymentDay());
            if (dueDate.isBefore(referenceDate) || dueDate.isBefore(today)) {
                continue;
            }

            entries.add(createEntry(bill, installmentNumber, dueDate));
            installmentNumber += 1;
        }

        return entries;
    }

    private int countScheduleEntriesBefore(Bill bill, LocalDate referenceDate) {
        int generatedEntries = 0;

        for (int monthOffset = 0; ; monthOffset += 1) {
            LocalDate dueDate = dueDateForMonth(bill.getStartFrom(), monthOffset, bill.getRepaymentDay());
            if (dueDate.isBefore(bill.getStartFrom())) {
                continue;
            }
            if (!dueDate.isBefore(referenceDate)) {
                break;
            }
            if (bill.getDurationType() == BillDurationType.UNTIL_DATE && bill.getEndDate() != null && dueDate.isAfter(bill.getEndDate())) {
                break;
            }

            generatedEntries += 1;
            if (bill.getDurationType() == BillDurationType.INSTALLMENTS
                    && bill.getInstallmentCount() != null
                    && generatedEntries >= bill.getInstallmentCount()) {
                break;
            }
        }

        return generatedEntries;
    }

    private BillScheduleEntry createEntry(Bill bill, int installmentNumber, LocalDate dueDate) {
        return new BillScheduleEntry(
                bill.getOwner(),
                bill,
                installmentNumber,
                dueDate,
                bill.getAmount(),
                bill.getCurrencyCode()
        );
    }

    private LocalDate dueDateForMonth(LocalDate startFrom, int monthOffset, int repaymentDay) {
        LocalDate candidate = startFrom.withDayOfMonth(1).plusMonths(monthOffset);
        int lastDayOfMonth = candidate.lengthOfMonth();
        return candidate.withDayOfMonth(Math.min(repaymentDay, lastDayOfMonth));
    }

    private LocalDate regenerationReferenceDate(Bill bill, LocalDate today) {
        return bill.getStartFrom().isAfter(today) ? bill.getStartFrom() : today;
    }
}
