package com.moneysnapshot.bill;

import com.moneysnapshot.account.AccountCurrencyChangedEvent;
import java.util.List;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class BillAccountCurrencySyncListener {

    private final BillRepository billRepository;
    private final BillScheduleEntryRepository billScheduleEntryRepository;

    public BillAccountCurrencySyncListener(
            BillRepository billRepository,
            BillScheduleEntryRepository billScheduleEntryRepository
    ) {
        this.billRepository = billRepository;
        this.billScheduleEntryRepository = billScheduleEntryRepository;
    }

    @EventListener
    public void onAccountCurrencyChanged(AccountCurrencyChangedEvent event) {
        List<Bill> bills = billRepository.findAllByAccountId(event.accountId());
        if (bills.isEmpty()) {
            return;
        }

        for (Bill bill : bills) {
            bill.updateCurrencyCode(event.currencyCode());
            for (BillScheduleEntry entry : billScheduleEntryRepository.findAllByBillIdOrderByDueDateAscInstallmentNumberAsc(bill.getId())) {
                entry.updateCurrencyCode(event.currencyCode());
            }
        }

        billScheduleEntryRepository.flush();
        billRepository.flush();
    }
}
