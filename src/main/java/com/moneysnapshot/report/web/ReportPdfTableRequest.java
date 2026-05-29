package com.moneysnapshot.report.web;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReportPdfTableRequest(
        @NotNull @Size(min = 1, max = 12) List<@Size(max = 120) String> columns,
        @NotNull @Size(max = 500) List<@NotNull @Size(max = 12) List<@Size(max = 240) String>> rows
) {
}
