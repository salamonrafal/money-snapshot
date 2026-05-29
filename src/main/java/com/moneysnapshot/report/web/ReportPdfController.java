package com.moneysnapshot.report.web;

import com.moneysnapshot.report.ReportPdfService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/reports/pdf")
public class ReportPdfController {

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
}
