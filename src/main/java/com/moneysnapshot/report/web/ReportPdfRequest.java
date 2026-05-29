package com.moneysnapshot.report.web;

import com.fasterxml.jackson.databind.JsonNode;

public record ReportPdfRequest(
        String title,
        String subtitle,
        String chartType,
        JsonNode chart,
        ReportPdfTableRequest table
) {
}
