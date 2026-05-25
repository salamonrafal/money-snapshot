package com.moneysnapshot.savings.web;

import com.moneysnapshot.savings.InvalidSavingsForecastRequestException;
import com.moneysnapshot.savings.SavingsForecastService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/savings-planning/forecasts")
public class SavingsForecastController {

    private final SavingsForecastService savingsForecastService;

    public SavingsForecastController(SavingsForecastService savingsForecastService) {
        this.savingsForecastService = savingsForecastService;
    }

    @GetMapping("/latest")
    public ResponseEntity<SavingsForecastRunResponse> latestForecast() {
        return savingsForecastService.latestForecast()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping
    public ResponseEntity<SavingsForecastRunResponse> generateForecast(
            @Valid @RequestBody GenerateSavingsForecastRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(savingsForecastService.generateForecast(request));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAllForecasts() {
        savingsForecastService.deleteAllForecasts();
    }

    @ExceptionHandler(InvalidSavingsForecastRequestException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleInvalidRequest(InvalidSavingsForecastRequestException exception) {
        return Map.of("message", exception.getMessage());
    }
}
