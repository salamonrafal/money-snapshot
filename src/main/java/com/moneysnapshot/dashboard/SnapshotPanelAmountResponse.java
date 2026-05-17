package com.moneysnapshot.dashboard;

import java.math.BigDecimal;

public record SnapshotPanelAmountResponse(String currencyCode, BigDecimal amount) {
}
