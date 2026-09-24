package com.moneysnapshot.currency.web;

import com.moneysnapshot.currency.CurrencyRateService;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/currency-rates")
public class CurrencyRateController {

    private final CurrencyRateService currencyRateService;

    public CurrencyRateController(CurrencyRateService currencyRateService) {
        this.currencyRateService = currencyRateService;
    }

    @GetMapping
    public CurrencyRatesResponse currentRates() {
        List<com.moneysnapshot.currency.CurrencyRateService.CurrencyRate> currentRates = currencyRateService.currentRates();
        List<CurrencyRateResponse> rates = currentRates.stream()
                .map(rate -> new CurrencyRateResponse(rate.code(), rate.name(), rate.rateToPln()))
                .toList();
        String effectiveDate = currentRates.stream()
                .findFirst()
                .map(CurrencyRateService.CurrencyRate::effectiveDate)
                .orElse("");
        return new CurrencyRatesResponse(effectiveDate, rates);
    }

    public record CurrencyRatesResponse(String effectiveDate, List<CurrencyRateResponse> rates) {
    }

    public record CurrencyRateResponse(String code, String name, BigDecimal rateToPln) {
    }
}
