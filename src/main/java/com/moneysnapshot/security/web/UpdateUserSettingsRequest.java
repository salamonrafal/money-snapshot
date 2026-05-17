package com.moneysnapshot.security.web;

import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record UpdateUserSettingsRequest(
        @NotNull Map<String, String> values
) {
}
