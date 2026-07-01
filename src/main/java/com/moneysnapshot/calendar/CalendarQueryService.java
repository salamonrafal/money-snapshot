package com.moneysnapshot.calendar;

import com.moneysnapshot.bill.Bill;
import com.moneysnapshot.bill.BillDurationType;
import com.moneysnapshot.bill.BillRepository;
import com.moneysnapshot.bill.BillStatus;
import com.moneysnapshot.calendar.web.CalendarEventResponse;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.snapshot.AccountSnapshot;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class CalendarQueryService {

    private static final int MAX_BILL_MONTHS = 600;

    private final BillRepository billRepository;
    private final AccountSnapshotRepository snapshotRepository;
    private final CurrentUserService currentUserService;
    private final UserSettingsService userSettingsService;
    private final Clock clock;

    @Autowired
    public CalendarQueryService(
            BillRepository billRepository,
            AccountSnapshotRepository snapshotRepository,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService
    ) {
        this(billRepository, snapshotRepository, currentUserService, userSettingsService, Clock.systemDefaultZone());
    }

    CalendarQueryService(
            BillRepository billRepository,
            AccountSnapshotRepository snapshotRepository,
            CurrentUserService currentUserService,
            UserSettingsService userSettingsService,
            Clock clock
    ) {
        this.billRepository = billRepository;
        this.snapshotRepository = snapshotRepository;
        this.currentUserService = currentUserService;
        this.userSettingsService = userSettingsService;
        this.clock = clock;
    }

    public List<CalendarEventResponse> listEvents(LocalDate fromDate, LocalDate toDate) {
        if (fromDate == null || toDate == null || toDate.isBefore(fromDate)) {
            return List.of();
        }

        UUID ownerId = currentUserService.currentUserId();
        List<CalendarEventResponse> events = new ArrayList<>();
        events.addAll(paymentEvents(ownerId, fromDate, toDate));
        events.addAll(snapshotEvents(ownerId, fromDate, toDate));
        events.addAll(billingPeriodEvents(fromDate, toDate));

        return events.stream()
                .sorted(Comparator.comparing(CalendarEventResponse::date)
                        .thenComparing(CalendarEventResponse::type)
                        .thenComparing(event -> event.title() == null ? "" : event.title(), String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private List<CalendarEventResponse> paymentEvents(UUID ownerId, LocalDate fromDate, LocalDate toDate) {
        return billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(ownerId).stream()
                .flatMap(bill -> dueDatesForBill(bill, fromDate, toDate).stream()
                        .map(dueDate -> new CalendarEventResponse(
                                "payment-%s-%s".formatted(bill.getId(), dueDate),
                                "PAYMENT",
                                dueDate,
                                bill.getName(),
                                joinParts(
                                        bill.getCounterparty() == null ? null : bill.getCounterparty().getName(),
                                        bill.getAccount() == null ? null : bill.getAccount().getName()
                                ),
                                bill.getAmount(),
                                bill.getCurrencyCode(),
                                null
                        )))
                .toList();
    }

    private List<LocalDate> dueDatesForBill(Bill bill, LocalDate fromDate, LocalDate toDate) {
        if (bill.getStartFrom() == null || bill.getRepaymentDay() == null) {
            return List.of();
        }

        LocalDate effectiveToDate = bill.getStatus() == BillStatus.COMPLETED
                ? minDate(toDate, LocalDate.now(clock))
                : toDate;
        if (effectiveToDate.isBefore(fromDate) || bill.getStartFrom().isAfter(effectiveToDate)) {
            return List.of();
        }

        List<LocalDate> dueDates = new ArrayList<>();
        long startMonthOffset = firstMonthOffsetForRange(bill.getStartFrom(), fromDate);
        int installmentNumber = installmentNumberAtOffset(bill, startMonthOffset);

        for (long monthOffset = startMonthOffset; monthOffset < startMonthOffset + MAX_BILL_MONTHS; monthOffset += 1) {
            LocalDate dueDate = dueDateForMonth(bill.getStartFrom(), monthOffset, bill.getRepaymentDay());
            if (dueDate.isBefore(bill.getStartFrom())) {
                continue;
            }
            if (dueDate.isAfter(effectiveToDate)) {
                break;
            }

            if (bill.getDurationType() == BillDurationType.UNTIL_DATE && bill.getEndDate() != null && dueDate.isAfter(bill.getEndDate())) {
                break;
            }

            if (bill.getDurationType() == BillDurationType.INSTALLMENTS) {
                int installmentCount = Math.max(bill.getInstallmentCount() == null ? 0 : bill.getInstallmentCount(), 0);
                if (installmentNumber > installmentCount) {
                    break;
                }
                if (!dueDate.isBefore(fromDate)) {
                    dueDates.add(dueDate);
                }
                installmentNumber += 1;
                continue;
            }

            if (!dueDate.isBefore(fromDate)) {
                dueDates.add(dueDate);
            }
        }

        return dueDates;
    }

    private long firstMonthOffsetForRange(LocalDate startFrom, LocalDate fromDate) {
        long monthOffset = ChronoUnit.MONTHS.between(startFrom.withDayOfMonth(1), fromDate.withDayOfMonth(1));
        return Math.max(0L, monthOffset - 1L);
    }

    private int installmentNumberAtOffset(Bill bill, long monthOffset) {
        if (bill.getDurationType() != BillDurationType.INSTALLMENTS || monthOffset == 0) {
            return 1;
        }

        int installmentNumber = 1;
        int installmentCount = Math.max(bill.getInstallmentCount() == null ? 0 : bill.getInstallmentCount(), 0);
        for (long offset = 0; offset < monthOffset && installmentNumber <= installmentCount; offset += 1) {
            LocalDate dueDate = dueDateForMonth(bill.getStartFrom(), offset, bill.getRepaymentDay());
            if (!dueDate.isBefore(bill.getStartFrom())) {
                installmentNumber += 1;
            }
        }
        return installmentNumber;
    }

    private LocalDate dueDateForMonth(LocalDate startFrom, long monthOffset, int repaymentDay) {
        LocalDate month = startFrom.plusMonths(monthOffset);
        return month.withDayOfMonth(Math.min(Math.max(repaymentDay, 1), month.lengthOfMonth()));
    }

    private List<CalendarEventResponse> snapshotEvents(UUID ownerId, LocalDate fromDate, LocalDate toDate) {
        return snapshotRepository.findAllByOwnerIdAndSnapshotDateBetweenWithAccountOrderBySnapshotDateAsc(ownerId, fromDate, toDate).stream()
                .map(snapshot -> new CalendarEventResponse(
                        "snapshot-%s".formatted(snapshot.getId()),
                        "SNAPSHOT",
                        snapshot.getSnapshotDate(),
                        snapshot.getAccount().getName(),
                        joinParts(
                                snapshot.getAccount().getBank() == null ? null : snapshot.getAccount().getBank().getName(),
                                normalizeText(snapshot.getNote())
                        ),
                        snapshot.getBalance(),
                        snapshot.getAccount().getCurrencyCode(),
                        snapshot.getSnapshotType() == null ? null : snapshot.getSnapshotType().name()
                ))
                .toList();
    }

    private List<CalendarEventResponse> billingPeriodEvents(LocalDate fromDate, LocalDate toDate) {
        int billingMonthEndDay = userSettingsService.currentUserSettings().billingMonthStartDay();
        int normalizedEndDay = Math.max(1, Math.min(31, billingMonthEndDay));
        LocalDate cursor = fromDate.minusMonths(1).withDayOfMonth(1);
        LocalDate endCursor = toDate.plusMonths(1).withDayOfMonth(1);
        List<CalendarEventResponse> events = new ArrayList<>();

        while (!cursor.isAfter(endCursor)) {
            LocalDate periodEnd = cursor.withDayOfMonth(Math.min(normalizedEndDay, cursor.lengthOfMonth()));
            LocalDate periodStart = periodEnd.plusDays(1);

            if (!periodStart.isBefore(fromDate) && !periodStart.isAfter(toDate)) {
                events.add(new CalendarEventResponse(
                        "billing-start-%s".formatted(periodStart),
                        "BILLING_PERIOD_START",
                        periodStart,
                        null,
                        null,
                        null,
                        null,
                        null
                ));
            }

            if (!periodEnd.isBefore(fromDate) && !periodEnd.isAfter(toDate)) {
                events.add(new CalendarEventResponse(
                        "billing-end-%s".formatted(periodEnd),
                        "BILLING_PERIOD_END",
                        periodEnd,
                        null,
                        null,
                        null,
                        null,
                        null
                ));
            }

            cursor = cursor.plusMonths(1);
        }

        return events;
    }

    private LocalDate minDate(LocalDate left, LocalDate right) {
        return left.isBefore(right) ? left : right;
    }

    private String joinParts(String left, String right) {
        String normalizedLeft = normalizeText(left);
        String normalizedRight = normalizeText(right);
        if (normalizedLeft == null) {
            return normalizedRight;
        }
        if (normalizedRight == null) {
            return normalizedLeft;
        }
        return normalizedLeft + " · " + normalizedRight;
    }

    private String normalizeText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
