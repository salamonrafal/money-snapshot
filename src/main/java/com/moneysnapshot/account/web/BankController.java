package com.moneysnapshot.account.web;

import com.moneysnapshot.account.BankService;
import com.moneysnapshot.account.BankInUseException;
import com.moneysnapshot.account.BankNotFoundException;
import com.moneysnapshot.account.DuplicateBankNameException;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/banks")
public class BankController {

    private final BankService bankService;

    public BankController(BankService bankService) {
        this.bankService = bankService;
    }

    @GetMapping
    public List<BankResponse> listBanks() {
        return bankService.listBanks().stream()
                .map(BankResponse::from)
                .toList();
    }

    @PostMapping
    public ResponseEntity<BankResponse> createBank(@Valid @RequestBody CreateBankRequest request) {
        BankResponse response = BankResponse.from(bankService.createBank(request));
        return ResponseEntity.created(URI.create("/api/banks/" + response.id())).body(response);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBank(@PathVariable UUID id) {
        bankService.deleteBank(id);
    }

    @ExceptionHandler(DuplicateBankNameException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleDuplicateBankName(DuplicateBankNameException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(BankInUseException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleBankInUse(BankInUseException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(BankNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleBankNotFound(BankNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }
}
