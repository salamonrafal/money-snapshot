package com.moneysnapshot.report;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.moneysnapshot.report.web.ReportPdfRequest;
import com.moneysnapshot.report.web.ReportPdfTableRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class ReportPdfService {

    private static final DateTimeFormatter DOWNLOAD_FILENAME_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm");
    private static final double PAGE_WIDTH = 841.89d;
    private static final double PAGE_HEIGHT = 595.28d;
    private static final double MARGIN = 28d;
    private static final long MAX_CACHE_BYTES = 16L * 1024L * 1024L;
    private static final long MAX_CACHEABLE_PDF_BYTES = 2L * 1024L * 1024L;
    private static final PdfColor TEXT = new PdfColor(24, 33, 47);
    private static final PdfColor MUTED = new PdfColor(97, 112, 132);
    private static final PdfColor LINE = new PdfColor(223, 229, 220);
    private static final PdfColor HEADER = new PdfColor(15, 139, 141);
    private static final PdfColor HEADER_DARK = new PdfColor(10, 111, 112);
    private static final PdfColor WASH = new PdfColor(232, 246, 244);
    private static final PdfColor ROW_ALT = new PdfColor(247, 250, 249);
    private static final PdfColor NAVY = new PdfColor(20, 33, 61);
    private static final PdfColor GOLD = new PdfColor(244, 185, 66);
    private static final PdfColor TEAL = new PdfColor(22, 163, 181);
    private static final PdfColor MINT = new PdfColor(53, 214, 182);
    private static final PdfColor WHITE = new PdfColor(255, 255, 255);
    private static final List<PdfColor> CHART_COLORS = List.of(
            HEADER,
            new PdfColor(163, 59, 47),
            new PdfColor(70, 102, 216),
            new PdfColor(124, 90, 27),
            new PdfColor(95, 75, 182),
            new PdfColor(36, 122, 61),
            new PdfColor(192, 90, 20),
            new PdfColor(69, 90, 100)
    );

    private final ObjectMapper objectMapper;
    private final ReportDataVersionService reportDataVersionService;
    private final LinkedHashMap<String, byte[]> pdfCache = new LinkedHashMap<>(16, 0.75f, true);
    private long pdfCacheBytes = 0L;

    public ReportPdfService(
            ObjectMapper objectMapper,
            ReportDataVersionService reportDataVersionService
    ) {
        this.objectMapper = objectMapper;
        this.reportDataVersionService = reportDataVersionService;
    }

    public byte[] generatePdf(String sectionKey, ReportPdfRequest request) {
        String cacheKey = cacheKey(sectionKey, request);
        byte[] cached = getCachedPdf(cacheKey);
        if (cached != null) {
            return cached;
        }

        byte[] pdf = renderPdf(request);
        cachePdf(cacheKey, pdf);
        return pdf;
    }

    public String filenameFor(String title) {
        String normalized = normalizePdfText(Objects.requireNonNullElse(title, "Raport")).toLowerCase();
        String slug = normalized.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        if (slug.isBlank()) {
            slug = "raport";
        }
        return slug + "-" + LocalDateTime.now().format(DOWNLOAD_FILENAME_TIMESTAMP) + ".pdf";
    }

    private String cacheKey(String sectionKey, ReportPdfRequest request) {
        return sectionKey + "|" + reportDataVersionService.currentVersion().cacheToken() + "|" + requestHash(request);
    }

    private String requestHash(ReportPdfRequest request) {
        try {
            return sha256(objectMapper.writeValueAsBytes(request));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize report PDF request.", exception);
        }
    }

    private synchronized byte[] getCachedPdf(String cacheKey) {
        return pdfCache.get(cacheKey);
    }

    private synchronized void cachePdf(String cacheKey, byte[] pdf) {
        if (pdf.length > MAX_CACHEABLE_PDF_BYTES) {
            return;
        }

        byte[] previous = pdfCache.remove(cacheKey);
        if (previous != null) {
            pdfCacheBytes -= previous.length;
        }

        pdfCache.put(cacheKey, pdf);
        pdfCacheBytes += pdf.length;

        while (pdfCacheBytes > MAX_CACHE_BYTES && !pdfCache.isEmpty()) {
            String eldestKey = pdfCache.keySet().iterator().next();
            byte[] removed = pdfCache.remove(eldestKey);
            if (removed != null) {
                pdfCacheBytes -= removed.length;
            }
        }
    }

    private String sha256(byte[] value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private byte[] renderPdf(ReportPdfRequest request) {
        PdfCanvas canvas = new PdfCanvas(request.title(), request.subtitle());
        if ("line".equals(request.chartType())) {
            drawLineChart(canvas, request.chart());
        } else if ("pie".equals(request.chartType())) {
            drawPieChart(canvas, request.chart());
        }
        drawTable(canvas, request.table());
        return canvas.build();
    }

    private void drawLineChart(PdfCanvas canvas, JsonNode chart) {
        JsonNode rows = chart == null ? null : chart.path("rows");
        JsonNode checkpoints = chart == null ? null : chart.path("checkpoints");
        if (rows == null || !rows.isArray() || checkpoints == null || !checkpoints.isArray() || rows.isEmpty() || checkpoints.isEmpty()) {
            return;
        }

        canvas.ensureSpace(190d);
        double chartX = MARGIN;
        double chartY = canvas.currentY() - 170d;
        double chartW = canvas.usableWidth();
        double chartH = 150d;
        canvas.rect(chartX, chartY, chartW, chartH, WASH, LINE);

        double plotX = chartX + 46d;
        double plotY = chartY + 28d;
        double plotW = chartW - 62d;
        double plotH = chartH - 52d;

        long startTime = isoDate(checkpoints.get(0).asText());
        long endTime = isoDate(checkpoints.get(checkpoints.size() - 1).asText());
        long timeRange = Math.max(1L, endTime - startTime);

        double minChange = 0d;
        double maxChange = 0d;
        for (JsonNode row : rows) {
            for (JsonNode point : row.path("series")) {
                double change = point.path("change").asDouble(0d);
                minChange = Math.min(minChange, change);
                maxChange = Math.max(maxChange, change);
            }
        }
        double changeRange = Math.max(1d, maxChange - minChange);

        double zeroY = plotY + ((0d - minChange) * plotH) / changeRange;
        canvas.line(plotX, zeroY, plotX + plotW, zeroY, MUTED, 0.5d);
        canvas.text("0", chartX + 18d, zeroY - 3d, 7d, "F1", MUTED);

        int legendIndex = 0;
        for (JsonNode row : rows) {
            if (legendIndex >= 8) {
                break;
            }

            PdfColor color = CHART_COLORS.get(legendIndex % CHART_COLORS.size());
            List<PdfPoint> linePoints = new ArrayList<>();
            for (JsonNode point : row.path("series")) {
                long pointTime = isoDate(point.path("date").asText());
                double x = plotX + ((double) (pointTime - startTime) * plotW) / timeRange;
                double y = plotY + ((point.path("change").asDouble(0d) - minChange) * plotH) / changeRange;
                linePoints.add(new PdfPoint(x, y));
            }
            canvas.polyline(linePoints, color, 1.5d);
            for (JsonNode point : row.path("points")) {
                long pointTime = isoDate(point.path("date").asText());
                double x = plotX + ((double) (pointTime - startTime) * plotW) / timeRange;
                double y = plotY + ((point.path("change").asDouble(0d) - minChange) * plotH) / changeRange;
                canvas.circle(x, y, 2.2d, color);
            }

            double legendX = chartX + 52d + (legendIndex % 4) * 170d;
            double legendY = chartY + chartH - 18d - Math.floor(legendIndex / 4d) * 11d;
            canvas.rect(legendX, legendY - 2d, 7d, 7d, color, null);
            canvas.text(row.path("name").asText(""), legendX + 11d, legendY - 1d, 6.5d, "F1", TEXT);
            legendIndex += 1;
        }

        canvas.setCurrentY(chartY - 16d);
    }

    private void drawPieChart(PdfCanvas canvas, JsonNode chart) {
        JsonNode rows = chart == null ? null : chart.path("rows");
        if (rows == null || !rows.isArray() || rows.isEmpty()) {
            return;
        }

        List<JsonNode> visibleRows = new ArrayList<>();
        for (JsonNode row : rows) {
            if (row.path("sharePercent").asDouble(0d) > 0d) {
                visibleRows.add(row);
            }
        }
        if (visibleRows.isEmpty()) {
            return;
        }

        canvas.ensureSpace(170d);
        double chartX = MARGIN;
        double chartY = canvas.currentY() - 150d;
        double chartW = canvas.usableWidth();
        double chartH = 132d;
        canvas.rect(chartX, chartY, chartW, chartH, WASH, LINE);

        double centerX = chartX + 80d;
        double centerY = chartY + 66d;
        double radius = 48d;
        double angle = -Math.PI / 2d;

        for (int index = 0; index < Math.min(visibleRows.size(), 10); index += 1) {
            JsonNode row = visibleRows.get(index);
            double share = Math.abs(row.path("sharePercent").asDouble(0d)) / 100d;
            double nextAngle = angle + share * Math.PI * 2d;
            List<PdfPoint> points = new ArrayList<>();
            points.add(new PdfPoint(centerX, centerY));
            int steps = Math.max(3, (int) Math.ceil((nextAngle - angle) / 0.18d));
            for (int step = 0; step <= steps; step += 1) {
                double currentAngle = angle + ((nextAngle - angle) * step) / steps;
                points.add(new PdfPoint(
                        centerX + Math.cos(currentAngle) * radius,
                        centerY - Math.sin(currentAngle) * radius
                ));
            }
            PdfColor color = CHART_COLORS.get(index % CHART_COLORS.size());
            canvas.filledPolygon(points, color);

            double legendX = chartX + 160d + (index % 2) * 285d;
            double legendY = chartY + chartH - 24d - Math.floor(index / 2d) * 18d;
            canvas.rect(legendX, legendY - 2d, 8d, 8d, color, null);
            String label = row.path("name").asText("")
                    + " (" + row.path("currencyCode").asText("") + ") "
                    + String.format(java.util.Locale.US, "%.1f%%", row.path("sharePercent").asDouble(0d));
            canvas.text(label, legendX + 13d, legendY - 1d, 7d, "F1", TEXT);
            angle = nextAngle;
        }

        canvas.setCurrentY(chartY - 16d);
    }

    private void drawTable(PdfCanvas canvas, ReportPdfTableRequest table) {
        List<String> columns = table == null || table.columns() == null ? List.of() : table.columns();
        List<List<String>> rows = table == null || table.rows() == null ? List.of() : table.rows();
        if (columns.isEmpty()) {
            canvas.text("No data", MARGIN, canvas.currentY(), 10d, "F1", TEXT);
            return;
        }

        int columnCount = columns.size();
        double columnWidth = canvas.usableWidth() / columnCount;
        double fontSize = columnCount > 8 ? 5.8d : (columnCount > 6 ? 6.5d : 7.5d);
        double lineHeight = fontSize + 2.5d;
        int maxChars = Math.max(7, (int) Math.floor(columnWidth / (fontSize * 0.5d)));

        drawTableRow(canvas, columns, -1, columnCount, columnWidth, fontSize, lineHeight, maxChars);
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex += 1) {
            drawTableRow(canvas, rows.get(rowIndex), rowIndex, columnCount, columnWidth, fontSize, lineHeight, maxChars);
        }
    }

    private void drawTableRow(
            PdfCanvas canvas,
            List<String> row,
            int rowIndex,
            int columnCount,
            double columnWidth,
            double fontSize,
            double lineHeight,
            int maxChars
    ) {
        boolean isHeader = rowIndex < 0;
        List<List<String>> wrappedCells = new ArrayList<>();
        int maxLines = 1;
        for (int columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
            List<String> lines = wrapPdfText(columnIndex < row.size() ? row.get(columnIndex) : "", maxChars);
            if (lines.size() > 4) {
                lines = lines.subList(0, 4);
            }
            wrappedCells.add(lines);
            maxLines = Math.max(maxLines, lines.size());
        }

        double rowHeight = maxLines * lineHeight + 9d;
        canvas.ensureSpace(rowHeight + 2d);
        double rowTop = canvas.currentY();
        double rowBottom = rowTop - rowHeight;
        PdfColor fillColor = isHeader ? HEADER : (rowIndex % 2 == 1 ? ROW_ALT : WHITE);
        canvas.rect(MARGIN, rowBottom, canvas.usableWidth(), rowHeight, fillColor, LINE);

        for (int columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
            double x = MARGIN + (columnIndex * columnWidth) + 4d;
            String font = isHeader ? "F2" : "F1";
            PdfColor color = isHeader ? WHITE : TEXT;
            List<String> lines = wrappedCells.get(columnIndex);
            for (int lineIndex = 0; lineIndex < lines.size(); lineIndex += 1) {
                canvas.text(lines.get(lineIndex), x, rowTop - 12d - (lineIndex * lineHeight), fontSize, font, color);
            }
            if (columnIndex > 0) {
                double columnX = MARGIN + (columnIndex * columnWidth);
                canvas.line(columnX, rowTop, columnX, rowBottom, isHeader ? HEADER_DARK : LINE, 0.45d);
            }
        }

        canvas.setCurrentY(rowBottom);
    }

    private List<String> wrapPdfText(String value, int maxLength) {
        String text = normalizePdfText(value);
        if (text.isBlank()) {
            return List.of("");
        }

        String[] words = text.split(" ");
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : words) {
            if (line.isEmpty()) {
                line.append(word);
            } else if (line.length() + 1 + word.length() <= maxLength) {
                line.append(' ').append(word);
            } else {
                lines.add(line.toString());
                line = new StringBuilder(word);
            }
        }
        if (!line.isEmpty()) {
            lines.add(line.toString());
        }
        return lines.isEmpty() ? List.of("") : lines;
    }

    private String normalizePdfText(String value) {
        String normalized = Normalizer.normalize(Objects.requireNonNullElse(value, ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('·', '-')
                .replace('–', '-')
                .replace('—', '-')
                .replace("…", "...");
        return normalized.replaceAll("[^\\x20-\\x7E]", " ").replaceAll("\\s+", " ").trim();
    }

    private long isoDate(String value) {
        return java.time.LocalDate.parse(value).toEpochDay();
    }

    private final class PdfCanvas {
        private final List<String> pages = new ArrayList<>();
        private final String title;
        private final String subtitle;
        private StringBuilder commands = new StringBuilder();
        private double y = PAGE_HEIGHT - MARGIN;

        private PdfCanvas(String title, String subtitle) {
            this.title = normalizePdfText(Objects.requireNonNullElse(title, "Report"));
            this.subtitle = normalizePdfText(Objects.requireNonNullElse(subtitle, ""));
            addPage();
            drawPageHeader();
        }

        private double currentY() {
            return y;
        }

        private void setCurrentY(double value) {
            y = value;
        }

        private double usableWidth() {
            return PAGE_WIDTH - (MARGIN * 2d);
        }

        private void addPage() {
            if (!commands.isEmpty()) {
                pages.add(commands.toString());
            }
            commands = new StringBuilder();
            y = PAGE_HEIGHT - MARGIN;
            stroke(LINE);
            fill(TEXT);
        }

        private void ensureSpace(double height) {
            if (y - height < 28d) {
                addPage();
                drawPageHeader();
            }
        }

        private void drawPageHeader() {
            double headerTop = PAGE_HEIGHT - MARGIN;
            double headerHeight = 86d;
            rect(MARGIN, headerTop - headerHeight, usableWidth(), headerHeight, NAVY, null);
            rect(MARGIN, headerTop - headerHeight, usableWidth(), 5d, GOLD, null);
            drawBrandMark(MARGIN + 18d, headerTop - 18d, 42d);
            text("Money Snapshot", MARGIN + 72d, headerTop - 34d, 10d, "F2", GOLD);
            text(title, MARGIN + 72d, headerTop - 57d, 20d, "F2", WHITE);
            text(subtitle.isBlank() ? title : subtitle, MARGIN + 72d, headerTop - 75d, 8d, "F1", WHITE);
            y = headerTop - headerHeight - 18d;
        }

        private void drawBrandMark(double x, double topY, double size) {
            double bottomY = topY - size;
            rect(x, bottomY, size, size, WHITE, null);
            rect(x + 3d, bottomY + 3d, size - 6d, size - 6d, NAVY, null);
            double barWidth = size * 0.1d;
            double barGap = size * 0.08d;
            double baseY = bottomY + size * 0.2d;
            double startX = x + size * 0.22d;
            double[] ratios = {0.28d, 0.42d, 0.56d, 0.72d};
            for (int index = 0; index < ratios.length; index += 1) {
                rect(startX + index * (barWidth + barGap), baseY, barWidth, size * ratios[index], index % 2 == 0 ? TEAL : MINT, null);
            }
            List<PdfPoint> points = List.of(
                    new PdfPoint(x + size * 0.25d, bottomY + size * 0.43d),
                    new PdfPoint(x + size * 0.43d, bottomY + size * 0.56d),
                    new PdfPoint(x + size * 0.61d, bottomY + size * 0.68d),
                    new PdfPoint(x + size * 0.8d, bottomY + size * 0.82d)
            );
            polyline(points, GOLD, 2d);
            for (PdfPoint point : points) {
                circle(point.x(), point.y(), size * 0.035d, GOLD);
            }
        }

        private void text(String text, double x, double textY, double size, String font, PdfColor color) {
            fill(color);
            commands.append("BT /")
                    .append(font)
                    .append(' ')
                    .append(format(size))
                    .append(" Tf ")
                    .append(format(x))
                    .append(' ')
                    .append(format(textY))
                    .append(" Td (")
                    .append(escapePdfText(text))
                    .append(") Tj ET\n");
        }

        private void line(double x1, double y1, double x2, double y2, PdfColor color, double width) {
            stroke(color);
            commands.append(format(width)).append(" w ")
                    .append(format(x1)).append(' ').append(format(y1)).append(" m ")
                    .append(format(x2)).append(' ').append(format(y2)).append(" l S\n");
        }

        private void rect(double x, double rectY, double width, double height, PdfColor fillColor, PdfColor strokeColor) {
            if (fillColor != null) {
                fill(fillColor);
                commands.append(format(x)).append(' ').append(format(rectY)).append(' ')
                        .append(format(width)).append(' ').append(format(height)).append(" re f\n");
            }
            if (strokeColor != null) {
                stroke(strokeColor);
                commands.append(format(x)).append(' ').append(format(rectY)).append(' ')
                        .append(format(width)).append(' ').append(format(height)).append(" re S\n");
            }
        }

        private void polyline(List<PdfPoint> points, PdfColor color, double width) {
            if (points.size() < 2) {
                return;
            }
            stroke(color);
            commands.append(format(width)).append(" w ");
            for (int index = 0; index < points.size(); index += 1) {
                PdfPoint point = points.get(index);
                commands.append(format(point.x())).append(' ').append(format(point.y())).append(index == 0 ? " m " : " l ");
            }
            commands.append("S\n");
        }

        private void filledPolygon(List<PdfPoint> points, PdfColor color) {
            if (points.size() < 3) {
                return;
            }
            fill(color);
            for (int index = 0; index < points.size(); index += 1) {
                PdfPoint point = points.get(index);
                commands.append(format(point.x())).append(' ').append(format(point.y())).append(index == 0 ? " m " : " l ");
            }
            commands.append("h f\n");
        }

        private void circle(double cx, double cy, double radius, PdfColor color) {
            fill(color);
            double k = 0.5522847498d * radius;
            commands.append(format(cx + radius)).append(' ').append(format(cy)).append(" m ")
                    .append(format(cx + radius)).append(' ').append(format(cy + k)).append(' ')
                    .append(format(cx + k)).append(' ').append(format(cy + radius)).append(' ')
                    .append(format(cx)).append(' ').append(format(cy + radius)).append(" c ")
                    .append(format(cx - k)).append(' ').append(format(cy + radius)).append(' ')
                    .append(format(cx - radius)).append(' ').append(format(cy + k)).append(' ')
                    .append(format(cx - radius)).append(' ').append(format(cy)).append(" c ")
                    .append(format(cx - radius)).append(' ').append(format(cy - k)).append(' ')
                    .append(format(cx - k)).append(' ').append(format(cy - radius)).append(' ')
                    .append(format(cx)).append(' ').append(format(cy - radius)).append(" c ")
                    .append(format(cx + k)).append(' ').append(format(cy - radius)).append(' ')
                    .append(format(cx + radius)).append(' ').append(format(cy - k)).append(' ')
                    .append(format(cx + radius)).append(' ').append(format(cy)).append(" c f\n");
        }

        private void stroke(PdfColor color) {
            commands.append(color.rgb()).append(" RG\n");
        }

        private void fill(PdfColor color) {
            commands.append(color.rgb()).append(" rg\n");
        }

        private String escapePdfText(String value) {
            return normalizePdfText(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
        }

        private byte[] build() {
            if (!commands.isEmpty()) {
                pages.add(commands.toString());
                commands = new StringBuilder();
            }

            List<String> objects = new ArrayList<>();
            int catalogId = addObject(objects, "<< /Type /Catalog /Pages 2 0 R >>");
            int pagesId = addObject(objects, "");
            int fontId = addObject(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
            int boldFontId = addObject(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
            List<Integer> pageIds = new ArrayList<>();

            for (String content : pages) {
                int contentId = addObject(objects, "<< /Length " + content.length() + " >>\nstream\n" + content + "\nendstream");
                int pageId = addObject(objects, "<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + PAGE_WIDTH + " " + PAGE_HEIGHT
                        + "] /Resources << /Font << /F1 " + fontId + " 0 R /F2 " + boldFontId + " 0 R >> >> /Contents " + contentId + " 0 R >>");
                pageIds.add(pageId);
            }

            objects.set(pagesId - 1, "<< /Type /Pages /Kids [" + pageIds.stream().map(id -> id + " 0 R").reduce((l, r) -> l + " " + r).orElse("")
                    + "] /Count " + pageIds.size() + " >>");

            List<byte[]> parts = new ArrayList<>();
            parts.add("%PDF-1.4\n".getBytes(StandardCharsets.US_ASCII));
            List<Integer> offsets = new ArrayList<>();
            offsets.add(0);
            int byteOffset = parts.get(0).length;

            for (int index = 0; index < objects.size(); index += 1) {
                offsets.add(byteOffset);
                byte[] objectBytes = ((index + 1) + " 0 obj\n" + objects.get(index) + "\nendobj\n").getBytes(StandardCharsets.US_ASCII);
                parts.add(objectBytes);
                byteOffset += objectBytes.length;
            }

            int xrefOffset = byteOffset;
            StringBuilder xref = new StringBuilder("xref\n0 ").append(objects.size() + 1).append('\n');
            for (int index = 0; index < offsets.size(); index += 1) {
                if (index == 0) {
                    xref.append("0000000000 65535 f \n");
                } else {
                    xref.append(String.format(java.util.Locale.US, "%010d 00000 n %n", offsets.get(index)));
                }
            }
            xref.append("trailer\n<< /Size ").append(objects.size() + 1).append(" /Root ").append(catalogId).append(" 0 R >>\n")
                    .append("startxref\n").append(xrefOffset).append("\n%%EOF");
            parts.add(xref.toString().getBytes(StandardCharsets.US_ASCII));

            int totalLength = parts.stream().mapToInt(part -> part.length).sum();
            byte[] result = new byte[totalLength];
            int position = 0;
            for (byte[] part : parts) {
                System.arraycopy(part, 0, result, position, part.length);
                position += part.length;
            }
            return result;
        }

        private int addObject(List<String> objects, String content) {
            objects.add(content);
            return objects.size();
        }

        private String format(double value) {
            return String.format(java.util.Locale.US, "%.2f", value);
        }
    }

    private record PdfColor(int red, int green, int blue) {
        private String rgb() {
            return String.format(
                    java.util.Locale.US,
                    "%.3f %.3f %.3f",
                    red / 255d,
                    green / 255d,
                    blue / 255d
            );
        }
    }

    private record PdfPoint(double x, double y) {
    }
}
