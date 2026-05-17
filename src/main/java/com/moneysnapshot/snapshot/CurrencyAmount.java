package com.moneysnapshot.snapshot;

import java.math.BigDecimal;

public record CurrencyAmount(String currencyCode, BigDecimal amount) {
}
