package com.moneysnapshot.bill;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.context.event.EventListener;

@Component
public class BillScheduleGenerationCoordinator {

    private static final Logger log = LoggerFactory.getLogger(BillScheduleGenerationCoordinator.class);

    private final BillScheduleService billScheduleService;

    public BillScheduleGenerationCoordinator(BillScheduleService billScheduleService) {
        this.billScheduleService = billScheduleService;
    }

    @EventListener
    public void onBillScheduleRegenerationRequested(BillScheduleRegenerationRequestedEvent event) {
        try {
            if (event.regenerateFromCurrentDate()) {
                billScheduleService.regenerateScheduleFromCurrentDate(event.billId());
            } else {
                billScheduleService.regenerateSchedule(event.billId());
            }
        } catch (RuntimeException exception) {
            log.warn("Failed to regenerate bill schedule for bill {}", event.billId(), exception);
        }
    }
}
