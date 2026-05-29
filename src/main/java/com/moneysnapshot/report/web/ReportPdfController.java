package com.moneysnapshot.report.web;

import com.moneysnapshot.report.ReportPdfService;
import java.nio.charset.StandardCharsets;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports/pdf")
public class ReportPdfController {

    private final ReportPdfService reportPdfService;

    public ReportPdfController(ReportPdfService reportPdfService) {
        this.reportPdfService = reportPdfService;
    }

    @PostMapping("/{sectionKey}")
    public ResponseEntity<byte[]> generatePdf(@PathVariable String sectionKey, @RequestBody ReportPdfRequest request) {
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
