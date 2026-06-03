package com.moneysnapshot.report;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.moneysnapshot.report.web.ReportPdfRequest;
import com.moneysnapshot.report.web.ReportPdfTableRequest;
import com.moneysnapshot.security.CurrentUserService;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Service;

@Service
public class ReportPdfService {

    private static final DateTimeFormatter DOWNLOAD_FILENAME_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm");
    private static final float PAGE_WIDTH = PDRectangle.A4.getHeight();
    private static final float PAGE_HEIGHT = PDRectangle.A4.getWidth();
    private static final float MARGIN = 28f;
    private static final float BOTTOM_MARGIN = 28f;
    private static final float USABLE_WIDTH = PAGE_WIDTH - (MARGIN * 2f);
    private static final int MAX_PIE_SLICES = 10;
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
    private final CurrentUserService currentUserService;
    private final LinkedHashMap<String, byte[]> pdfCache = new LinkedHashMap<>(16, 0.75f, true);
    private long pdfCacheBytes = 0L;

    public ReportPdfService(
            ObjectMapper objectMapper,
            ReportDataVersionService reportDataVersionService,
            CurrentUserService currentUserService
    ) {
        this.objectMapper = objectMapper;
        this.reportDataVersionService = reportDataVersionService;
        this.currentUserService = currentUserService;
    }

    public byte[] generatePdf(String sectionKey, ReportPdfRequest request) {
        UUID ownerId = currentUserService.currentUserId();
        String cacheKey = cacheKey(ownerId, sectionKey, request);
        byte[] cached = getCachedPdf(cacheKey);
        if (cached != null) {
            return cached.clone();
        }

        byte[] pdf = renderPdf(request);
        cachePdf(cacheKey, pdf);
        return pdf.clone();
    }

    public String filenameFor(String title) {
        String normalized = Normalizer.normalize(Objects.requireNonNullElse(title, "Raport"), Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "");
        String slug = normalized.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{Alnum}]+", "-")
                .replaceAll("(^-+|-+$)", "");
        if (slug.isBlank()) {
            slug = "raport";
        }
        return slug + "-" + LocalDateTime.now().format(DOWNLOAD_FILENAME_TIMESTAMP) + ".pdf";
    }

    private String cacheKey(UUID ownerId, String sectionKey, ReportPdfRequest request) {
        return ownerId + "|" + sectionKey + "|" + reportDataVersionService.currentVersion().cacheToken() + "|" + requestHash(request);
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

    public synchronized void clearCache() {
        pdfCache.clear();
        pdfCacheBytes = 0L;
    }

    public synchronized void clearCache(UUID ownerId) {
        String ownerPrefix = ownerId + "|";
        var iterator = pdfCache.entrySet().iterator();
        while (iterator.hasNext()) {
            var entry = iterator.next();
            if (entry.getKey().startsWith(ownerPrefix)) {
                pdfCacheBytes -= entry.getValue().length;
                iterator.remove();
            }
        }
    }

    private synchronized void cachePdf(String cacheKey, byte[] pdf) {
        if (pdf.length > MAX_CACHEABLE_PDF_BYTES) {
            return;
        }

        byte[] previous = pdfCache.remove(cacheKey);
        if (previous != null) {
            pdfCacheBytes -= previous.length;
        }

        byte[] cachedCopy = pdf.clone();
        pdfCache.put(cacheKey, cachedCopy);
        pdfCacheBytes += cachedCopy.length;

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
        try (PDDocument document = new PDDocument();
             InputStream regularStream = fontStream("DejaVuSans.ttf");
             InputStream boldStream = fontStream("DejaVuSans-Bold.ttf")) {
            PDFont regularFont = PDType0Font.load(document, regularStream, true);
            PDFont boldFont = PDType0Font.load(document, boldStream, true);
            try (PdfCanvas canvas = new PdfCanvas(document, regularFont, boldFont, request.title(), request.subtitle())) {
                if ("line".equals(request.chartType())) {
                    drawLineChart(canvas, request.chart());
                } else if ("pie".equals(request.chartType())) {
                    drawPieChart(canvas, request.chart());
                }
                drawTable(canvas, request.table());
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            document.save(outputStream);
            return outputStream.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to render report PDF.", exception);
        }
    }

    private InputStream fontStream(String resourceName) {
        InputStream stream = ReportPdfService.class.getResourceAsStream("/fonts/" + resourceName);
        if (stream == null) {
            throw new IllegalStateException("Missing PDF font resource: " + resourceName);
        }
        return stream;
    }

    private void drawLineChart(PdfCanvas canvas, JsonNode chart) throws IOException {
        JsonNode rows = chart == null ? null : chart.path("rows");
        JsonNode checkpoints = chart == null ? null : chart.path("checkpoints");
        if (rows == null || !rows.isArray() || checkpoints == null || !checkpoints.isArray() || rows.isEmpty() || checkpoints.isEmpty()) {
            return;
        }

        List<Long> checkpointDates = new ArrayList<>();
        for (JsonNode checkpoint : checkpoints) {
            Long checkpointDate = isoDate(checkpoint.asText(null));
            if (checkpointDate != null) {
                checkpointDates.add(checkpointDate);
            }
        }
        if (checkpointDates.size() < 2) {
            return;
        }

        int legendCount = Math.min(rows.size(), 8);
        int legendColumns = legendCount <= 1 ? 1 : 2;
        int legendRows = legendCount == 0 ? 0 : (int) Math.ceil(legendCount / (double) legendColumns);
        float legendAreaHeight = legendCount == 0 ? 0f : 14f + (legendRows * 14f);
        float chartH = 138f + legendAreaHeight;

        canvas.ensureSpace(chartH + 24f);
        float chartX = MARGIN;
        float chartY = canvas.currentY() - chartH;
        float chartW = USABLE_WIDTH;
        canvas.rect(chartX, chartY, chartW, chartH, WASH, LINE, true, true);

        float plotX = chartX + 46f;
        float plotY = chartY + legendAreaHeight + 34f;
        float plotW = chartW - 62f;
        float plotH = chartH - legendAreaHeight - 62f;

        long startTime = checkpointDates.get(0);
        long endTime = checkpointDates.get(checkpointDates.size() - 1);
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

        float zeroY = (float) (plotY + ((0d - minChange) * plotH) / changeRange);
        canvas.line(plotX, zeroY, plotX + plotW, zeroY, MUTED, 0.5f);
        canvas.text("0", chartX + 18f, zeroY - 3f, 7f, false, MUTED);

        int legendIndex = 0;
        for (JsonNode row : rows) {
            PdfColor color = CHART_COLORS.get(legendIndex % CHART_COLORS.size());
            List<PdfPoint> linePoints = new ArrayList<>();
            for (JsonNode point : row.path("series")) {
                Long pointTime = isoDate(point.path("date").asText(null));
                if (pointTime == null) {
                    continue;
                }
                float x = (float) (plotX + ((double) (pointTime - startTime) * plotW) / timeRange);
                float y = (float) (plotY + ((point.path("change").asDouble(0d) - minChange) * plotH) / changeRange);
                linePoints.add(new PdfPoint(x, y));
            }
            if (!linePoints.isEmpty()) {
                canvas.polyline(linePoints, color, 1.5f);
            }

            for (JsonNode point : row.path("points")) {
                Long pointTime = isoDate(point.path("date").asText(null));
                if (pointTime == null) {
                    continue;
                }
                float x = (float) (plotX + ((double) (pointTime - startTime) * plotW) / timeRange);
                float y = (float) (plotY + ((point.path("change").asDouble(0d) - minChange) * plotH) / changeRange);
                canvas.circle(x, y, 2.2f, color);
            }

            if (legendIndex < 8) {
                float legendColumnWidth = (chartW - 72f) / legendColumns;
                float legendX = chartX + 36f + (legendIndex % legendColumns) * legendColumnWidth;
                float legendY = (float) (chartY + legendAreaHeight - 12f - Math.floor(legendIndex / (double) legendColumns) * 14f);
                canvas.rect(legendX, legendY - 2f, 7f, 7f, color, null, true, false);
                canvas.text(trimLabel(row.path("name").asText(""), 34), legendX + 11f, legendY - 1f, 6.5f, false, TEXT);
            }
            legendIndex += 1;
        }

        canvas.setCurrentY(chartY - 16f);
    }

    private String trimLabel(String value, int maxLength) {
        String normalized = Objects.requireNonNullElse(value, "");
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, Math.max(0, maxLength - 1)) + "…";
    }

    private void drawPieChart(PdfCanvas canvas, JsonNode chart) throws IOException {
        JsonNode rows = chart == null ? null : chart.path("rows");
        if (rows == null || !rows.isArray() || rows.isEmpty()) {
            return;
        }
        String otherLabel = chart == null ? null : chart.path("otherLabel").asText(null);
        if (otherLabel == null || otherLabel.isBlank()) {
            otherLabel = "Other";
        }

        List<PieSlice> visibleRows = new ArrayList<>();
        for (JsonNode row : rows) {
            double sharePercent = row.path("sharePercent").asDouble(0d);
            if (sharePercent > 0d) {
                visibleRows.add(new PieSlice(
                        row.path("name").asText(""),
                        row.path("currencyCode").asText(""),
                        sharePercent
                ));
            }
        }
        if (visibleRows.isEmpty()) {
            return;
        }

        visibleRows.sort(Comparator.comparingDouble(PieSlice::sharePercent).reversed());
        if (visibleRows.size() > MAX_PIE_SLICES) {
            List<PieSlice> topSlices = new ArrayList<>(visibleRows.subList(0, MAX_PIE_SLICES - 1));
            double otherSharePercent = visibleRows.subList(MAX_PIE_SLICES - 1, visibleRows.size()).stream()
                    .mapToDouble(PieSlice::sharePercent)
                    .sum();
            topSlices.add(new PieSlice(otherLabel, "", otherSharePercent));
            visibleRows = topSlices;
        }

        canvas.ensureSpace(170f);
        float chartX = MARGIN;
        float chartY = canvas.currentY() - 150f;
        float chartW = USABLE_WIDTH;
        float chartH = 132f;
        canvas.rect(chartX, chartY, chartW, chartH, WASH, LINE, true, true);

        float centerX = chartX + 80f;
        float centerY = chartY + 66f;
        float radius = 48f;
        double angle = -Math.PI / 2d;

        for (int index = 0; index < visibleRows.size(); index += 1) {
            PieSlice row = visibleRows.get(index);
            double share = Math.abs(row.sharePercent()) / 100d;
            double nextAngle = angle + share * Math.PI * 2d;
            List<PdfPoint> points = new ArrayList<>();
            points.add(new PdfPoint(centerX, centerY));
            int steps = Math.max(3, (int) Math.ceil((nextAngle - angle) / 0.18d));
            for (int step = 0; step <= steps; step += 1) {
                double currentAngle = angle + ((nextAngle - angle) * step) / steps;
                points.add(new PdfPoint(
                        (float) (centerX + Math.cos(currentAngle) * radius),
                        (float) (centerY - Math.sin(currentAngle) * radius)
                ));
            }
            PdfColor color = CHART_COLORS.get(index % CHART_COLORS.size());
            canvas.filledPolygon(points, color);

            float legendX = chartX + 160f + (index % 2) * 285f;
            float legendY = (float) (chartY + chartH - 24f - Math.floor(index / 2d) * 18f);
            canvas.rect(legendX, legendY - 2f, 8f, 8f, color, null, true, false);
            String label = row.currencyCode().isBlank()
                    ? row.name() + " " + String.format(Locale.US, "%.1f%%", row.sharePercent())
                    : row.name() + " (" + row.currencyCode() + ") " + String.format(Locale.US, "%.1f%%", row.sharePercent());
            canvas.text(label, legendX + 13f, legendY - 1f, 7f, false, TEXT);
            angle = nextAngle;
        }

        canvas.setCurrentY(chartY - 16f);
    }

    private void drawTable(PdfCanvas canvas, ReportPdfTableRequest table) throws IOException {
        List<String> columns = table == null || table.columns() == null ? List.of() : table.columns();
        List<List<String>> rows = table == null || table.rows() == null ? List.of() : table.rows();
        if (columns.isEmpty()) {
            canvas.text("No data", MARGIN, canvas.currentY(), 10f, false, TEXT);
            return;
        }

        int columnCount = columns.size();
        float columnWidth = USABLE_WIDTH / columnCount;
        float fontSize = columnCount > 8 ? 5.8f : (columnCount > 6 ? 6.5f : 7.5f);
        float lineHeight = fontSize + 2.5f;

        drawTableRow(canvas, columns, -1, columnCount, columnWidth, fontSize, lineHeight);
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex += 1) {
            boolean pageBreakOccurred = drawTableRow(canvas, rows.get(rowIndex), rowIndex, columnCount, columnWidth, fontSize, lineHeight);
            if (pageBreakOccurred) {
                drawTableRow(canvas, columns, -1, columnCount, columnWidth, fontSize, lineHeight);
                drawTableRow(canvas, rows.get(rowIndex), rowIndex, columnCount, columnWidth, fontSize, lineHeight);
            }
        }
    }

    private boolean drawTableRow(
            PdfCanvas canvas,
            List<String> row,
            int rowIndex,
            int columnCount,
            float columnWidth,
            float fontSize,
            float lineHeight
    ) throws IOException {
        boolean isHeader = rowIndex < 0;
        List<List<String>> wrappedCells = new ArrayList<>();
        int maxLines = 1;
        for (int columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
            List<String> lines = canvas.wrapText(columnIndex < row.size() ? row.get(columnIndex) : "", columnWidth - 8f, fontSize, isHeader);
            if (lines.size() > 4) {
                lines = lines.subList(0, 4);
            }
            wrappedCells.add(lines);
            maxLines = Math.max(maxLines, lines.size());
        }

        float rowHeight = maxLines * lineHeight + 9f;
        int pageCountBefore = canvas.pageCount();
        canvas.ensureSpace(rowHeight + 2f);
        boolean pageBreakOccurred = canvas.pageCount() != pageCountBefore;
        if (pageBreakOccurred && !isHeader) {
            return true;
        }
        float rowTop = canvas.currentY();
        float rowBottom = rowTop - rowHeight;
        PdfColor fillColor = isHeader ? HEADER : (rowIndex % 2 == 1 ? ROW_ALT : WHITE);
        canvas.rect(MARGIN, rowBottom, USABLE_WIDTH, rowHeight, fillColor, LINE, true, true);

        for (int columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
            float x = MARGIN + (columnIndex * columnWidth) + 4f;
            PdfColor color = isHeader ? WHITE : TEXT;
            List<String> lines = wrappedCells.get(columnIndex);
            for (int lineIndex = 0; lineIndex < lines.size(); lineIndex += 1) {
                canvas.text(lines.get(lineIndex), x, rowTop - 12f - (lineIndex * lineHeight), fontSize, isHeader, color);
            }
            if (columnIndex > 0) {
                float columnX = MARGIN + (columnIndex * columnWidth);
                canvas.line(columnX, rowTop, columnX, rowBottom, isHeader ? HEADER_DARK : LINE, 0.45f);
            }
        }

        canvas.setCurrentY(rowBottom);
        return false;
    }

    private Long isoDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(value).toEpochDay();
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    private static final class PdfCanvas implements AutoCloseable {
        private final PDDocument document;
        private final PDFont regularFont;
        private final PDFont boldFont;
        private final String title;
        private final String subtitle;
        private PDPage page;
        private PDPageContentStream stream;
        private float y = PAGE_HEIGHT - MARGIN;

        private PdfCanvas(PDDocument document, PDFont regularFont, PDFont boldFont, String title, String subtitle) throws IOException {
            this.document = document;
            this.regularFont = regularFont;
            this.boldFont = boldFont;
            this.title = Objects.requireNonNullElse(title, "Report");
            this.subtitle = Objects.requireNonNullElse(subtitle, "");
            addPage();
            drawPageHeader();
        }

        private float currentY() {
            return y;
        }

        private void setCurrentY(float value) {
            y = value;
        }

        private void addPage() throws IOException {
            if (stream != null) {
                stream.close();
            }
            page = new PDPage(new PDRectangle(PAGE_WIDTH, PAGE_HEIGHT));
            document.addPage(page);
            stream = new PDPageContentStream(document, page);
            y = PAGE_HEIGHT - MARGIN;
        }

        private void ensureSpace(float height) throws IOException {
            if (y - height < BOTTOM_MARGIN) {
                addPage();
                drawPageHeader();
            }
        }

        private int pageCount() {
            return document.getNumberOfPages();
        }

        private void drawPageHeader() throws IOException {
            float headerTop = PAGE_HEIGHT - MARGIN;
            float headerHeight = 86f;
            rect(MARGIN, headerTop - headerHeight, USABLE_WIDTH, headerHeight, NAVY, null, true, false);
            rect(MARGIN, headerTop - headerHeight, USABLE_WIDTH, 5f, GOLD, null, true, false);
            drawBrandMark(MARGIN + 18f, headerTop - 18f, 42f);
            text("Money Snapshot", MARGIN + 72f, headerTop - 34f, 10f, true, GOLD);
            text(title, MARGIN + 72f, headerTop - 57f, 20f, true, WHITE);
            text(subtitle.isBlank() ? title : subtitle, MARGIN + 72f, headerTop - 75f, 8f, false, WHITE);
            y = headerTop - headerHeight - 18f;
        }

        private void drawBrandMark(float x, float topY, float size) throws IOException {
            float bottomY = topY - size;
            rect(x, bottomY, size, size, WHITE, null, true, false);
            rect(x + 3f, bottomY + 3f, size - 6f, size - 6f, NAVY, null, true, false);
            float barWidth = size * 0.1f;
            float barGap = size * 0.08f;
            float baseY = bottomY + size * 0.2f;
            float startX = x + size * 0.22f;
            float[] ratios = {0.28f, 0.42f, 0.56f, 0.72f};
            for (int index = 0; index < ratios.length; index += 1) {
                rect(startX + index * (barWidth + barGap), baseY, barWidth, size * ratios[index], index % 2 == 0 ? TEAL : MINT, null, true, false);
            }
            List<PdfPoint> points = List.of(
                    new PdfPoint(x + size * 0.25f, bottomY + size * 0.43f),
                    new PdfPoint(x + size * 0.43f, bottomY + size * 0.56f),
                    new PdfPoint(x + size * 0.61f, bottomY + size * 0.68f),
                    new PdfPoint(x + size * 0.8f, bottomY + size * 0.82f)
            );
            polyline(points, GOLD, 2f);
            for (PdfPoint point : points) {
                circle(point.x(), point.y(), size * 0.035f, GOLD);
            }
        }

        private void text(String text, float x, float baselineY, float fontSize, boolean bold, PdfColor color) throws IOException {
            String sanitizedText = sanitizeText(text, bold);
            stream.beginText();
            stream.setNonStrokingColor(color.awt());
            stream.setFont(bold ? boldFont : regularFont, fontSize);
            stream.newLineAtOffset(x, baselineY);
            stream.showText(sanitizedText);
            stream.endText();
        }

        private float textWidth(String text, float fontSize, boolean bold) throws IOException {
            PDFont font = bold ? boldFont : regularFont;
            return font.getStringWidth(sanitizeText(text, bold)) / 1000f * fontSize;
        }

        private List<String> wrapText(String text, float maxWidth, float fontSize, boolean bold) throws IOException {
            String normalized = Objects.requireNonNullElse(text, "").replaceAll("\\s+", " ").trim();
            if (normalized.isEmpty()) {
                return List.of("");
            }

            String[] words = normalized.split(" ");
            List<String> lines = new ArrayList<>();
            StringBuilder currentLine = new StringBuilder();
            for (String word : words) {
                if (currentLine.length() == 0 && textWidth(word, fontSize, bold) > maxWidth) {
                    lines.addAll(breakLongToken(word, maxWidth, fontSize, bold));
                    continue;
                }

                String candidate = currentLine.length() == 0 ? word : currentLine + " " + word;
                if (textWidth(candidate, fontSize, bold) <= maxWidth) {
                    currentLine.setLength(0);
                    currentLine.append(candidate);
                } else {
                    lines.add(currentLine.toString());
                    currentLine.setLength(0);
                    if (textWidth(word, fontSize, bold) > maxWidth) {
                        lines.addAll(breakLongToken(word, maxWidth, fontSize, bold));
                    } else {
                        currentLine.append(word);
                    }
                }
            }
            if (currentLine.length() > 0) {
                lines.add(currentLine.toString());
            }
            return lines.isEmpty() ? List.of("") : lines;
        }

        private List<String> breakLongToken(String token, float maxWidth, float fontSize, boolean bold) throws IOException {
            List<String> lines = new ArrayList<>();
            StringBuilder segment = new StringBuilder();
            for (int index = 0; index < token.length(); index += 1) {
                char nextChar = token.charAt(index);
                String candidate = segment + String.valueOf(nextChar);
                if (segment.length() > 0 && textWidth(candidate, fontSize, bold) > maxWidth) {
                    lines.add(segment.toString());
                    segment.setLength(0);
                }
                segment.append(nextChar);
            }
            if (segment.length() > 0) {
                lines.add(segment.toString());
            }
            return lines.isEmpty() ? List.of("") : lines;
        }

        private String sanitizeText(String text, boolean bold) throws IOException {
            String value = Objects.requireNonNullElse(text, "");
            PDFont font = bold ? boldFont : regularFont;
            StringBuilder sanitized = new StringBuilder(value.length());
            for (int offset = 0; offset < value.length(); ) {
                int codePoint = value.codePointAt(offset);
                String symbol = new String(Character.toChars(codePoint));
                if (canEncode(font, symbol)) {
                    sanitized.append(symbol);
                } else if (Character.isWhitespace(codePoint)) {
                    sanitized.append(' ');
                } else if (canEncode(font, "?")) {
                    sanitized.append('?');
                }
                offset += Character.charCount(codePoint);
            }
            return sanitized.toString();
        }

        private boolean canEncode(PDFont font, String symbol) throws IOException {
            try {
                font.encode(symbol);
                return true;
            } catch (IllegalArgumentException exception) {
                return false;
            }
        }

        private void line(float x1, float y1, float x2, float y2, PdfColor color, float width) throws IOException {
            stream.setStrokingColor(color.awt());
            stream.setLineWidth(width);
            stream.moveTo(x1, y1);
            stream.lineTo(x2, y2);
            stream.stroke();
        }

        private void rect(float x, float y, float width, float height, PdfColor fillColor, PdfColor strokeColor, boolean fill, boolean stroke) throws IOException {
            stream.addRect(x, y, width, height);
            if (fill && stroke && fillColor != null && strokeColor != null) {
                stream.setNonStrokingColor(fillColor.awt());
                stream.setStrokingColor(strokeColor.awt());
                stream.fillAndStroke();
            } else if (fill && fillColor != null) {
                stream.setNonStrokingColor(fillColor.awt());
                stream.fill();
            } else if (stroke && strokeColor != null) {
                stream.setStrokingColor(strokeColor.awt());
                stream.stroke();
            }
        }

        private void polyline(List<PdfPoint> points, PdfColor color, float width) throws IOException {
            if (points.size() < 2) {
                return;
            }
            stream.setStrokingColor(color.awt());
            stream.setLineWidth(width);
            stream.moveTo(points.get(0).x(), points.get(0).y());
            for (int index = 1; index < points.size(); index += 1) {
                stream.lineTo(points.get(index).x(), points.get(index).y());
            }
            stream.stroke();
        }

        private void filledPolygon(List<PdfPoint> points, PdfColor color) throws IOException {
            if (points.size() < 3) {
                return;
            }
            stream.setNonStrokingColor(color.awt());
            stream.moveTo(points.get(0).x(), points.get(0).y());
            for (int index = 1; index < points.size(); index += 1) {
                stream.lineTo(points.get(index).x(), points.get(index).y());
            }
            stream.closePath();
            stream.fill();
        }

        private void circle(float cx, float cy, float radius, PdfColor color) throws IOException {
            List<PdfPoint> points = new ArrayList<>();
            int segments = 10;
            for (int index = 0; index < segments; index += 1) {
                double angle = (Math.PI * 2d * index) / segments;
                points.add(new PdfPoint(
                        (float) (cx + Math.cos(angle) * radius),
                        (float) (cy + Math.sin(angle) * radius)
                ));
            }
            filledPolygon(points, color);
        }

        @Override
        public void close() throws IOException {
            if (stream != null) {
                stream.close();
            }
        }
    }

    private record PdfColor(int red, int green, int blue) {
        private Color awt() {
            return new Color(red, green, blue);
        }
    }

    private record PieSlice(String name, String currencyCode, double sharePercent) {
    }

    private record PdfPoint(float x, float y) {
    }
}
