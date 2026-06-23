package com.moneysnapshot.counterparty.web;

import com.moneysnapshot.counterparty.CounterpartyNotFoundException;
import com.moneysnapshot.counterparty.CounterpartyService;
import com.moneysnapshot.counterparty.DuplicateCounterpartyNameException;
import com.moneysnapshot.counterparty.CounterpartyInUseException;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/counterparties")
public class CounterpartyController {

    private final CounterpartyService counterpartyService;

    public CounterpartyController(CounterpartyService counterpartyService) {
        this.counterpartyService = counterpartyService;
    }

    @GetMapping
    public List<CounterpartyResponse> listCounterparties() {
        return counterpartyService.listCounterparties().stream()
                .map(CounterpartyResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    public CounterpartyResponse getCounterparty(@PathVariable UUID id) {
        return CounterpartyResponse.from(counterpartyService.getCounterparty(id));
    }

    @PostMapping
    public ResponseEntity<CounterpartyResponse> createCounterparty(@Valid @RequestBody CreateCounterpartyRequest request) {
        CounterpartyResponse response = CounterpartyResponse.from(counterpartyService.createCounterparty(request));
        return ResponseEntity.created(URI.create("/api/counterparties/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    public CounterpartyResponse updateCounterparty(@PathVariable UUID id, @Valid @RequestBody CreateCounterpartyRequest request) {
        return CounterpartyResponse.from(counterpartyService.updateCounterparty(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCounterparty(@PathVariable UUID id) {
        counterpartyService.deleteCounterparty(id);
    }

    @ExceptionHandler(DuplicateCounterpartyNameException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleDuplicateCounterpartyName(DuplicateCounterpartyNameException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(CounterpartyNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleCounterpartyNotFound(CounterpartyNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(CounterpartyInUseException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleCounterpartyInUse(CounterpartyInUseException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> handleValidationFailure(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getCode());
        }

        return Map.of(
                "message", "Validation failed.",
                "fieldErrors", fieldErrors
        );
    }
}
