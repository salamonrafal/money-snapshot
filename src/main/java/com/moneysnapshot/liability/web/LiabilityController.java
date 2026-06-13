package com.moneysnapshot.liability.web;

import com.moneysnapshot.liability.Liability;
import com.moneysnapshot.liability.LiabilityRepayment;
import com.moneysnapshot.liability.LiabilityService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/liabilities")
public class LiabilityController {

    private final LiabilityService liabilityService;

    public LiabilityController(LiabilityService liabilityService) {
        this.liabilityService = liabilityService;
    }

    @GetMapping
    public LiabilityDashboardResponse listLiabilities() {
        return liabilityService.listDashboard();
    }

    @GetMapping("/summary")
    public LiabilitySummaryResponse getSummary() {
        return liabilityService.getSummary();
    }

    @GetMapping("/{id}")
    public LiabilityResponse getLiability(@PathVariable UUID id) {
        return liabilityService.getLiabilityResponse(id);
    }

    @GetMapping("/repayments/{repaymentId}")
    public LiabilityRepaymentResponse getRepayment(@PathVariable UUID repaymentId) {
        return liabilityService.getLiabilityRepaymentResponse(repaymentId);
    }

    @PostMapping
    public ResponseEntity<LiabilityResponse> createLiability(@Valid @RequestBody CreateLiabilityRequest request) {
        Liability saved = liabilityService.createLiability(request);
        LiabilityResponse response = LiabilityResponse.from(saved, java.util.List.of());
        return ResponseEntity.created(URI.create("/api/liabilities/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LiabilityResponse> updateLiability(
            @PathVariable UUID id,
            @Valid @RequestBody CreateLiabilityRequest request
    ) {
        Liability saved = liabilityService.updateLiability(id, request);
        LiabilityResponse response = LiabilityResponse.from(saved, liabilityService.getLiabilityRepaymentResponses(id));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLiability(@PathVariable UUID id) {
        liabilityService.deleteLiability(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/repayments")
    public ResponseEntity<LiabilityRepaymentResponse> registerRepayment(
            @PathVariable UUID id,
            @Valid @RequestBody RegisterLiabilityRepaymentRequest request
    ) {
        LiabilityRepayment saved = liabilityService.registerRepayment(id, request);
        LiabilityRepaymentResponse response = LiabilityRepaymentResponse.from(saved);
        return ResponseEntity.created(URI.create("/api/liabilities/" + id + "/repayments/" + response.id())).body(response);
    }

    @PutMapping("/repayments/{repaymentId}")
    public ResponseEntity<LiabilityRepaymentResponse> updateRepayment(
            @PathVariable UUID repaymentId,
            @Valid @RequestBody RegisterLiabilityRepaymentRequest request
    ) {
        LiabilityRepayment saved = liabilityService.updateRepayment(repaymentId, request);
        return ResponseEntity.ok(LiabilityRepaymentResponse.from(saved));
    }

    @DeleteMapping("/repayments/{repaymentId}")
    public ResponseEntity<Void> deleteRepayment(@PathVariable UUID repaymentId) {
        liabilityService.deleteRepayment(repaymentId);
        return ResponseEntity.noContent().build();
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

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of(
                "message", exception.getReason() == null ? "Request failed." : exception.getReason()
        ));
    }
}
