package com.moneysnapshot.account;

import java.util.UUID;

public record AccountCurrencyChangedEvent(UUID accountId, String currencyCode) {
}
