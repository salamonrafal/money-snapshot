package com.moneysnapshot.account.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateSavingsContributionSettingsRequest(
        @NotNull
        @Size(min = 0, max = 500)
        List<@Valid SavingsContributionSettingRequest> accounts
) {
}
