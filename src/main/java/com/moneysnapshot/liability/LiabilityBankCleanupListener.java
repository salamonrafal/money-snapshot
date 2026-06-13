package com.moneysnapshot.liability;

import com.moneysnapshot.account.BankDeletionRequestedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
public class LiabilityBankCleanupListener {

    private final LiabilityRepository liabilityRepository;

    public LiabilityBankCleanupListener(LiabilityRepository liabilityRepository) {
        this.liabilityRepository = liabilityRepository;
    }

    @Order(20)
    @EventListener
    public void onBankDeletionRequested(BankDeletionRequestedEvent event) {
        liabilityRepository.deleteByBankId(event.bankId());
    }
}
