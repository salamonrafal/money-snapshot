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
import java.util.List;
import java.util.UUID;
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

        assertThat(first).isSameAs(second);
    }

    @Test
    void regeneratesPdfWhenReportDataVersionChanges() {
        when(reportDataVersionService.currentVersion()).thenReturn(version("v1"), version("v2"));

        ReportPdfRequest request = requestWithTable(
                "Zestawienie zmian",
                "Zakres testowy",
                List.of("Nazwa", "Kwota"),
                List.of(List.of("Konto 1", "100.00"))
        );

        byte[] first = service.generatePdf("summary", request);
        byte[] second = service.generatePdf("summary", request);

        assertThat(first).isNotSameAs(second);
        assertThat(second).isNotEmpty();
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

        String pdf = new String(service.generatePdf("summary", request), StandardCharsets.US_ASCII);

        assertThat(pdf).contains("%PDF-1.4");
        assertThat(pdf).contains("\\(test\\)");
        assertThat(pdf).contains("proba");
        assertThat(pdf).contains("Cma \\(A/B\\)");
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

        String pdf = new String(service.generatePdf("history", request), StandardCharsets.US_ASCII);

        assertThat(countOccurrences(pdf, "/Type /Page ")).isGreaterThan(1);
        assertThat(pdf).contains("/Count ");
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

    private int countOccurrences(String value, String token) {
        int count = 0;
        int index = 0;
        while ((index = value.indexOf(token, index)) >= 0) {
            count += 1;
            index += token.length();
        }
        return count;
    }
}
