package com.moneysnapshot.currency;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class CurrencyRateService {

    private static final URI NBP_TABLE_URI = URI.create("https://api.nbp.pl/api/exchangerates/tables/A/");
    private static final Duration CACHE_DURATION = Duration.ofMinutes(15);
    private static final Set<String> SUPPORTED_CURRENCIES = Set.of("PLN", "EUR", "USD");

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private volatile CachedRates cachedRates;

    public CurrencyRateService(ObjectMapper objectMapper) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.objectMapper = objectMapper;
    }

    public List<CurrencyRate> currentRates() {
        CachedRates current = cachedRates;
        if (current != null && current.cachedAt().plus(CACHE_DURATION).isAfter(Instant.now())) {
            return current.rates();
        }

        synchronized (this) {
            current = cachedRates;
            if (current != null && current.cachedAt().plus(CACHE_DURATION).isAfter(Instant.now())) {
                return current.rates();
            }

            List<CurrencyRate> rates = fetchRates();
            cachedRates = new CachedRates(rates, Instant.now());
            return rates;
        }
    }

    private List<CurrencyRate> fetchRates() {
        HttpRequest request = HttpRequest.newBuilder(NBP_TABLE_URI)
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new CurrencyRateException("NBP returned HTTP status " + response.statusCode());
            }
            return parseRates(response.body());
        } catch (IOException exception) {
            throw new CurrencyRateException("Cannot load currency rates from NBP.", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new CurrencyRateException("Loading currency rates from NBP was interrupted.", exception);
        }
    }

    private List<CurrencyRate> parseRates(String body) throws IOException {
        JsonNode tables = objectMapper.readTree(body);
        if (!tables.isArray() || tables.isEmpty()) {
            throw new CurrencyRateException("NBP returned an empty currency table.");
        }

        JsonNode table = tables.get(0);
        String effectiveDate = table.path("effectiveDate").asText("");
        List<CurrencyRate> rates = new ArrayList<>();
        rates.add(new CurrencyRate("PLN", "złoty polski", BigDecimal.ONE, effectiveDate));

        for (JsonNode rate : table.path("rates")) {
            String code = rate.path("code").asText("").trim().toUpperCase();
            BigDecimal mid = rate.path("mid").decimalValue();
            if (SUPPORTED_CURRENCIES.contains(code) && mid.signum() > 0) {
                rates.add(new CurrencyRate(code, rate.path("currency").asText(code), mid, effectiveDate));
            }
        }

        rates.sort(Comparator.comparing(CurrencyRate::code));
        return List.copyOf(rates);
    }

    public record CurrencyRate(String code, String name, BigDecimal rateToPln, String effectiveDate) {
    }

    private record CachedRates(List<CurrencyRate> rates, Instant cachedAt) {
    }
}
