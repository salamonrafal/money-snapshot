package com.moneysnapshot.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.moneysnapshot.account.Account;
import com.moneysnapshot.account.AccountStatus;
import com.moneysnapshot.account.Bank;
import com.moneysnapshot.bill.Bill;
import com.moneysnapshot.bill.BillDurationType;
import com.moneysnapshot.bill.BillRepository;
import com.moneysnapshot.bill.BillStatus;
import com.moneysnapshot.calendar.web.CalendarEventResponse;
import com.moneysnapshot.counterparty.Counterparty;
import com.moneysnapshot.security.AppUser;
import com.moneysnapshot.security.CurrentUserService;
import com.moneysnapshot.security.UserSettingsService;
import com.moneysnapshot.security.web.UserSettingsResponse;
import com.moneysnapshot.snapshot.AccountSnapshotRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CalendarQueryServiceTest {

    @Mock
    private BillRepository billRepository;

    @Mock
    private AccountSnapshotRepository snapshotRepository;

    @Mock
    private CurrentUserService currentUserService;

    @Mock
    private UserSettingsService userSettingsService;

    @Test
    void listEventsIncludesOpenEndedBillStartedMoreThanSixHundredMonthsBeforeRange() {
        UUID ownerId = UUID.randomUUID();
        AppUser owner = org.mockito.Mockito.mock(AppUser.class);
        Bank bank = new Bank(owner, "Main bank", "main-bank");
        Account account = new Account(bank, owner, "Personal PLN", "personal-pln", "BANK_ACCOUNT", "PLN", null, null, AccountStatus.ACTIVE);
        Counterparty counterparty = new Counterparty(owner, "Power company", "power-company", "12121212121212121212121212", null, null);
        Bill bill = new Bill(
                owner,
                counterparty,
                account,
                "Electricity",
                "electricity",
                "PLN",
                new BigDecimal("120.00"),
                BillDurationType.OPEN_ENDED,
                null,
                null,
                15,
                LocalDate.of(1970, 1, 15),
                BillStatus.ACTIVE
        );
        CalendarQueryService service = new CalendarQueryService(
                billRepository,
                snapshotRepository,
                currentUserService,
                userSettingsService,
                Clock.fixed(Instant.parse("2026-07-01T10:00:00Z"), ZoneId.of("Europe/Warsaw"))
        );

        when(currentUserService.currentUserId()).thenReturn(ownerId);
        when(billRepository.findAllByOwnerIdOrderByRepaymentDayAndName(ownerId)).thenReturn(List.of(bill));
        when(snapshotRepository.findAllByOwnerIdAndSnapshotDateBetweenWithAccountOrderBySnapshotDateAsc(
                ownerId,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 31)
        )).thenReturn(List.of());
        when(userSettingsService.currentUserSettings()).thenReturn(new UserSettingsResponse("PLN", "light", "Y-m-d H:m", "### ###,00 zl", 1, Map.of()));

        List<CalendarEventResponse> events = service.listEvents(LocalDate.of(2026, 7, 1), LocalDate.of(2026, 7, 31));

        assertThat(events)
                .anySatisfy(event -> {
                    assertThat(event.type()).isEqualTo("PAYMENT");
                    assertThat(event.date()).isEqualTo(LocalDate.of(2026, 7, 15));
                    assertThat(event.title()).isEqualTo("Electricity");
                });
    }
}
