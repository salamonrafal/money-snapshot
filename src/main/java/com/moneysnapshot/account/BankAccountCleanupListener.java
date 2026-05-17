package com.moneysnapshot.account;

import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
public class BankAccountCleanupListener {

    private final AccountRepository accountRepository;

    public BankAccountCleanupListener(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Order(20)
    @EventListener
    public void onBankDeletionRequested(BankDeletionRequestedEvent event) {
        accountRepository.deleteByBankId(event.bankId());
    }
}
