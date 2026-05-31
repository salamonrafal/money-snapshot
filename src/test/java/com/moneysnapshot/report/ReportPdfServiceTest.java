package com.moneysnapshot.report;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.moneysnapshot.report.web.ReportPdfRequest;
import com.moneysnapshot.report.web.ReportPdfTableRequest;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class ReportPdfServiceTest {

    private final ReportDataVersionService reportDataVersionService = mock(ReportDataVersionService.class);
    private final ReportPdfService service = new ReportPdfService(new ObjectMapper(), reportDataVersionService);

    @Test
    void returnsCachedPdfForIdenticalSectionVersionAndPayload() {
        when(reportDataVersionService.currentVersion()).thenReturn(version("v1"));

        ReportPdfRequest request = requestWithTable(
                "Zestawienie zmian",
                "Zakres testowy",
                List.of("Nazwa", "Kwota"),
                List.of(List.of("Konto 1", "100.00"))
        );

        byte[] first = service.generatePdf("summary", request);
        byte[] second = service.generatePdf("summary", request);

        assertThat(first).isNotEmpty();
        assertThat(second).isNotEmpty();
        assertThat(readPdfCache()).hasSize(1);
    }

    @Test
    void storesSeparateCacheEntriesWhenReportDataVersionChanges() {
        when(reportDataVersionService.currentVersion()).thenReturn(version("v1"), version("v2"));

        ReportPdfRequest request = requestWithTable(
                "Zestawienie zmian",
                "Zakres testowy",
                List.of("Nazwa", "Kwota"),
                List.of(List.of("Konto 1", "100.00"))
        );

        byte[] first = service.generatePdf("summary", request);
        byte[] second = service.generatePdf("summary", request);

        assertThat(first).isNotEmpty();
        assertThat(second).isNotEmpty();
        assertThat(readPdfCache()).hasSize(2);
    }

    @Test
    void normalizesAndEscapesPdfTextContent() {
        when(reportDataVersionService.currentVersion()).thenReturn(version("v1"));

        ReportPdfRequest request = requestWithTable(
                "Zażółć (test)",
                "Łódź · próba",
                List.of("Nazwa"),
                List.of(List.of("Ćma (A/B)"))
        );

        String pdfText = extractText(service.generatePdf("summary", request));

        assertThat(pdfText).contains("Zażółć (test)");
        assertThat(pdfText).contains("Łódź · próba");
        assertThat(pdfText).contains("Ćma (A/B)");
    }

    @Test
    void createsMultiplePagesForLargeTables() {
        when(reportDataVersionService.currentVersion()).thenReturn(version("v1"));

        List<List<String>> rows = new ArrayList<>();
        for (int index = 0; index < 220; index += 1) {
            rows.add(List.of(
                    "Konto " + index,
                    "PLN",
                    "Wiersz testowy " + index,
                    "12345.67"
            ));
        }

        ReportPdfRequest request = requestWithTable(
                "Historia srodkow",
                "Duza tabela",
                List.of("Konto", "Waluta", "Opis", "Kwota"),
                rows
        );

        try (PDDocument document = Loader.loadPDF(service.generatePdf("history", request))) {
            assertThat(document.getNumberOfPages()).isGreaterThan(1);
        } catch (Exception exception) {
            throw new AssertionError("Failed to inspect generated PDF", exception);
        }
    }

    @Test
    void replacesCharactersUnsupportedByPdfFontInsteadOfFailingExport() {
        when(reportDataVersionService.currentVersion()).thenReturn(version("v1"));
        String unsupportedSymbol = "\uE000";

        ReportPdfRequest request = requestWithTable(
                "Raport " + unsupportedSymbol,
                "Zakres testowy",
                List.of("Nazwa"),
                List.of(List.of("Konto " + unsupportedSymbol))
        );

        String pdfText = extractText(service.generatePdf("summary", request));

        assertThat(pdfText).contains("Raport ?");
        assertThat(pdfText).contains("Konto ?");
    }

    private ReportPdfRequest requestWithTable(
            String title,
            String subtitle,
            List<String> columns,
            List<List<String>> rows
    ) {
        ObjectNode chart = JsonNodeFactory.instance.objectNode();
        return new ReportPdfRequest(
                title,
                subtitle,
                null,
                chart,
                new ReportPdfTableRequest(columns, rows)
        );
    }

    private ReportDataVersionService.ReportDataVersion version(String token) {
        OffsetDateTime timestamp = OffsetDateTime.parse("2026-05-29T12:00:00Z");
        return new ReportDataVersionService.ReportDataVersion(
                new ReportDataVersionService.EntityAggregate(1, timestamp.plusSeconds(token.hashCode() & 15)),
                new ReportDataVersionService.EntityAggregate(1, timestamp.plusSeconds(token.hashCode() & 15)),
                new ReportDataVersionService.EntityAggregate(1, timestamp.plusSeconds(token.hashCode() & 15)),
                new ReportDataVersionService.ForecastAggregate(UUID.nameUUIDFromBytes(token.getBytes(StandardCharsets.UTF_8)), timestamp)
        );
    }

    private String extractText(byte[] pdfBytes) {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            return new PDFTextStripper().getText(document);
        } catch (Exception exception) {
            throw new AssertionError("Failed to extract text from generated PDF", exception);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, byte[]> readPdfCache() {
        try {
            var field = ReportPdfService.class.getDeclaredField("pdfCache");
            field.setAccessible(true);
            return (LinkedHashMap<String, byte[]>) field.get(service);
        } catch (ReflectiveOperationException exception) {
            throw new AssertionError("Failed to inspect PDF cache", exception);
        }
    }
}
