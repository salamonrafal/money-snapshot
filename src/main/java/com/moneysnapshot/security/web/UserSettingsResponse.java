package com.moneysnapshot.security.web;

import java.util.Map;

public record UserSettingsResponse(
        String defaultCurrency,
        String theme,
        String dateTimeFormat,
        String moneyFormat,
        Integer billingMonthStartDay,
        Map<String, String> values
) {
}
