package com.moneysnapshot.report.web;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReportPdfRequest(
        @NotBlank @Size(max = 160) String title,
        @Size(max = 200) String subtitle,
        @Size(max = 16) String chartType,
        JsonNode chart,
        @NotNull @Valid ReportPdfTableRequest table
) {
}
