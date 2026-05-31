package com.moneysnapshot.report.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ReportPdfRequestSizeFilter extends OncePerRequestFilter {

    private static final long MAX_REQUEST_BYTES = 4L * 1024L * 1024L;
    private static final String PAYLOAD_TOO_LARGE_MESSAGE = "Report PDF payload is too large.";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod())
                || !request.getServletPath().startsWith("/api/reports/pdf/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long contentLength = request.getContentLengthLong();
        if (contentLength > MAX_REQUEST_BYTES) {
            writePayloadTooLargeResponse(response);
            return;
        }

        try {
            filterChain.doFilter(new LimitedRequestWrapper(request, MAX_REQUEST_BYTES), response);
        } catch (PayloadTooLargeException exception) {
            writePayloadTooLargeResponse(response);
        }
    }

    private void writePayloadTooLargeResponse(HttpServletResponse response) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.resetBuffer();
        response.setStatus(HttpStatus.PAYLOAD_TOO_LARGE.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"message\":\"" + PAYLOAD_TOO_LARGE_MESSAGE + "\"}");
        response.flushBuffer();
    }

    private static final class LimitedRequestWrapper extends HttpServletRequestWrapper {

        private final long maxBytes;
        private ServletInputStream inputStream;

        private LimitedRequestWrapper(HttpServletRequest request, long maxBytes) {
            super(request);
            this.maxBytes = maxBytes;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (inputStream == null) {
                inputStream = new LimitedServletInputStream(super.getInputStream(), maxBytes);
            }
            return inputStream;
        }
    }

    private static final class LimitedServletInputStream extends ServletInputStream {

        private final ServletInputStream delegate;
        private final long maxBytes;
        private long bytesRead = 0L;

        private LimitedServletInputStream(ServletInputStream delegate, long maxBytes) {
            this.delegate = delegate;
            this.maxBytes = maxBytes;
        }

        @Override
        public int read() throws IOException {
            int value = delegate.read();
            if (value != -1) {
                bytesRead += 1;
                ensureWithinLimit();
            }
            return value;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            int read = delegate.read(b, off, len);
            if (read > 0) {
                bytesRead += read;
                ensureWithinLimit();
            }
            return read;
        }

        @Override
        public boolean isFinished() {
            return delegate.isFinished();
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            delegate.setReadListener(readListener);
        }

        private void ensureWithinLimit() throws PayloadTooLargeException {
            if (bytesRead > maxBytes) {
                throw new PayloadTooLargeException();
            }
        }
    }

    static final class PayloadTooLargeException extends IOException {
    }
}
