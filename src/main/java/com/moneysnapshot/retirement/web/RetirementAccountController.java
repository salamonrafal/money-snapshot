package com.moneysnapshot.retirement.web;

import com.moneysnapshot.retirement.DuplicateRetirementAccountNameException;
import com.moneysnapshot.retirement.RetirementAccountNotFoundException;
import com.moneysnapshot.retirement.RetirementAccountService;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/retirement-accounts")
public class RetirementAccountController {

    private final RetirementAccountService retirementAccountService;

    public RetirementAccountController(RetirementAccountService retirementAccountService) {
        this.retirementAccountService = retirementAccountService;
    }

    @GetMapping
    public List<RetirementAccountResponse> listAccounts() {
        return retirementAccountService.listAccounts().stream()
                .map(RetirementAccountResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    public RetirementAccountResponse getAccount(@PathVariable UUID id) {
        return RetirementAccountResponse.from(retirementAccountService.getAccount(id));
    }

    @GetMapping("/contributions")
    public List<RetirementAccountContributionResponse> listContributions() {
        return retirementAccountService.listContributions().stream()
                .map(RetirementAccountContributionResponse::from)
                .toList();
    }

    @GetMapping("/{id}/contributions")
    public List<RetirementAccountContributionResponse> listContributions(@PathVariable UUID id) {
        return retirementAccountService.listContributions(id).stream()
                .map(RetirementAccountContributionResponse::from)
                .toList();
    }

    @PostMapping
    public ResponseEntity<RetirementAccountResponse> createAccount(@Valid @RequestBody CreateRetirementAccountRequest request) {
        RetirementAccountResponse response = RetirementAccountResponse.from(retirementAccountService.createAccount(request));
        return ResponseEntity.created(URI.create("/api/retirement-accounts/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    public RetirementAccountResponse updateAccount(@PathVariable UUID id, @Valid @RequestBody CreateRetirementAccountRequest request) {
        return RetirementAccountResponse.from(retirementAccountService.updateAccount(id, request));
    }

    @PatchMapping("/{id}/balance")
    public RetirementAccountResponse updateBalance(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRetirementAccountBalanceRequest request
    ) {
        return RetirementAccountResponse.from(retirementAccountService.updateBalance(id, request));
    }

    @PostMapping("/{id}/contributions")
    public ResponseEntity<RetirementAccountContributionResponse> registerContribution(
            @PathVariable UUID id,
            @Valid @RequestBody CreateRetirementAccountContributionRequest request
    ) {
        RetirementAccountContributionResponse response = RetirementAccountContributionResponse.from(
                retirementAccountService.registerContribution(id, request)
        );
        return ResponseEntity.created(URI.create("/api/retirement-accounts/" + id + "/contributions/" + response.id()))
                .body(response);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@PathVariable UUID id) {
        retirementAccountService.deleteAccount(id);
    }

    @ExceptionHandler(DuplicateRetirementAccountNameException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleDuplicateName(DuplicateRetirementAccountNameException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(RetirementAccountNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleNotFound(RetirementAccountNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleInvalidAction(IllegalArgumentException exception) {
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
