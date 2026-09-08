package com.moneysnapshot.bill.web;

import com.moneysnapshot.bill.BillScheduleService;
import com.moneysnapshot.bill.BillPaymentPeriod;
import com.moneysnapshot.security.UserSettingsService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UpcomingBillPaymentController {
    private final BillScheduleService service;
    private final UserSettingsService settingsService;

    public UpcomingBillPaymentController(BillScheduleService service, UserSettingsService settingsService) {
        this.service = service;
        this.settingsService = settingsService;
    }

    @GetMapping("/api/bills/upcoming-payments")
    public List<UpcomingBillPaymentResponse> list() {
        // Despite its historical name, this setting is the inclusive period end day.
        var period = BillPaymentPeriod.current(LocalDate.now(), settingsService.currentUserSettings().billingMonthStartDay());
        return service.listUpcomingPayments(period.start(), period.end());
    }
}
