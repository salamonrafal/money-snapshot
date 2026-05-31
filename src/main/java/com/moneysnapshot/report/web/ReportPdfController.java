package com.moneysnapshot.report.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.moneysnapshot.report.ReportPdfService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Set;
import java.util.Map.Entry;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/reports/pdf")
public class ReportPdfController {

    private static final int MAX_CHART_NODE_COUNT = 4_000;
    private static final int MAX_CHART_ARRAY_ITEMS = 1_500;
    private static final int MAX_CHART_TEXT_LENGTH = 20_000;
    private static final int MAX_CHART_DEPTH = 64;
    private static final Set<String> SUPPORTED_SECTION_KEYS = Set.of(
            "summary",
            "overview",
            "averageContributions",
            "planning",
            "history"
    );

    private final ReportPdfService reportPdfService;

    public ReportPdfController(ReportPdfService reportPdfService) {
        this.reportPdfService = reportPdfService;
    }

    @PostMapping("/{sectionKey}")
    public ResponseEntity<byte[]> generatePdf(@PathVariable String sectionKey, @Valid @RequestBody ReportPdfRequest request) {
        if (!SUPPORTED_SECTION_KEYS.contains(sectionKey)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported report section.");
        }
        validateChartPayload(request.chart());

        byte[] pdf = reportPdfService.generatePdf(sectionKey, request);
        String filename = reportPdfService.filenameFor(request.title());

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(filename, StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private void validateChartPayload(JsonNode chart) {
        if (chart == null || chart.isNull()) {
            return;
        }

        AtomicInteger nodeCount = new AtomicInteger();
        Deque<ChartNodeFrame> stack = new ArrayDeque<>();
        stack.push(new ChartNodeFrame(chart, 0));
        while (!stack.isEmpty()) {
            ChartNodeFrame frame = stack.pop();
            validateChartNode(frame.node(), frame.depth(), nodeCount, stack);
        }
    }

    private void validateChartNode(JsonNode node, int depth, AtomicInteger nodeCount, Deque<ChartNodeFrame> stack) {
        if (depth > MAX_CHART_DEPTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report chart payload is too deep.");
        }

        if (nodeCount.incrementAndGet() > MAX_CHART_NODE_COUNT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report chart payload is too large.");
        }

        if (node.isTextual() && node.textValue().length() > MAX_CHART_TEXT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report chart payload is too large.");
        }

        if (node.isArray()) {
            if (node.size() > MAX_CHART_ARRAY_ITEMS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report chart payload is too large.");
            }
            for (JsonNode child : node) {
                stack.push(new ChartNodeFrame(child, depth + 1));
            }
            return;
        }

        if (node.isObject()) {
            Iterator<Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Entry<String, JsonNode> field = fields.next();
                if (field.getKey().length() > 120) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Report chart payload is too large.");
                }
                stack.push(new ChartNodeFrame(field.getValue(), depth + 1));
            }
        }
    }

    private record ChartNodeFrame(JsonNode node, int depth) {
    }
}
