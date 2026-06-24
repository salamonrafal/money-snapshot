package com.moneysnapshot.account.web;

import com.moneysnapshot.account.AccountInUseException;
import com.moneysnapshot.account.AccountNotFoundException;
import com.moneysnapshot.account.AccountService;
import com.moneysnapshot.account.DuplicateAccountNameException;
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
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping
    public List<AccountResponse> listAccounts() {
        return accountService.listAccounts().stream()
                .map(AccountResponse::from)
                .toList();
    }

    @GetMapping("/snapshots")
    public List<AccountResponse> listAccountsVisibleInSnapshots() {
        return accountService.listAccountsVisibleInSnapshots().stream()
                .map(AccountResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    public AccountResponse getAccount(@PathVariable UUID id) {
        return AccountResponse.from(accountService.getAccount(id));
    }

    @PostMapping
    public ResponseEntity<AccountResponse> createAccount(@Valid @RequestBody CreateAccountRequest request) {
        AccountResponse response = AccountResponse.from(accountService.createAccount(request));
        return ResponseEntity.created(URI.create("/api/accounts/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    public AccountResponse updateAccount(@PathVariable UUID id, @Valid @RequestBody CreateAccountRequest request) {
        return AccountResponse.from(accountService.updateAccount(id, request));
    }

    @GetMapping("/savings-planning")
    public List<SavingsContributionSettingResponse> listSavingsContributionSettings() {
        return accountService.listAccounts().stream()
                .map(SavingsContributionSettingResponse::from)
                .toList();
    }

    @PutMapping("/savings-planning")
    public List<SavingsContributionSettingResponse> updateSavingsContributionSettings(
            @Valid @RequestBody UpdateSavingsContributionSettingsRequest request
    ) {
        return accountService.updateForecastedMonthlyContributions(request.accounts()).stream()
                .map(SavingsContributionSettingResponse::from)
                .toList();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@PathVariable UUID id) {
        accountService.deleteAccount(id);
    }

    @ExceptionHandler(DuplicateAccountNameException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleDuplicateAccountName(DuplicateAccountNameException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(AccountNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleAccountNotFound(AccountNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(AccountInUseException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleAccountInUse(AccountInUseException exception) {
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
