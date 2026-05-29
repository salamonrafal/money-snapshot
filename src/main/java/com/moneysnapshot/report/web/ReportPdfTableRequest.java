package com.moneysnapshot.report.web;

import java.util.List;

public record ReportPdfTableRequest(
        List<String> columns,
        List<List<String>> rows
) {
}
