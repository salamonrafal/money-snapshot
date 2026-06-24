package com.moneysnapshot.bill;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class BillScheduleGenerationCoordinator {

    private final BillScheduleService billScheduleService;

    public BillScheduleGenerationCoordinator(BillScheduleService billScheduleService) {
        this.billScheduleService = billScheduleService;
    }

    @EventListener
    public void onBillScheduleRegenerationRequested(BillScheduleRegenerationRequestedEvent event) {
        if (event.regenerateFromCurrentDate()) {
            billScheduleService.regenerateScheduleFromCurrentDate(event.billId());
        } else {
            billScheduleService.regenerateSchedule(event.billId());
        }
    }
}
