package com.moneysnapshot.liability.web;

import java.util.List;

public record LiabilityDashboardResponse(
        LiabilitySummaryResponse summary,
        List<LiabilityResponse> liabilities
) {
}
