package com.moneysnapshot.snapshot.web;

import com.moneysnapshot.account.AccountNotFoundException;
import com.moneysnapshot.snapshot.AccountSnapshotNotFoundException;
import com.moneysnapshot.snapshot.AccountSnapshotService;
import com.moneysnapshot.snapshot.DuplicateAccountSnapshotException;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/snapshots")
public class AccountSnapshotController {

    private final AccountSnapshotService snapshotService;

    public AccountSnapshotController(AccountSnapshotService snapshotService) {
        this.snapshotService = snapshotService;
    }

    @GetMapping
    public Object listSnapshots(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) UUID accountId
    ) {
        if (page != null || size != null) {
            int pageNumber = Math.max(page == null ? 0 : page, 0);
            int pageSize = Math.max(1, Math.min(size == null ? 20 : size, 100));
            return PagedAccountSnapshotResponse.from(snapshotService.listSnapshots(accountId, PageRequest.of(pageNumber, pageSize))
                    .map(AccountSnapshotResponse::from));
        }

        return snapshotService.listSnapshots().stream()
                .map(AccountSnapshotResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    public AccountSnapshotResponse getSnapshot(@PathVariable UUID id) {
        return AccountSnapshotResponse.from(snapshotService.getSnapshot(id));
    }

    @PostMapping
    public ResponseEntity<AccountSnapshotResponse> createSnapshot(@Valid @RequestBody CreateAccountSnapshotRequest request) {
        AccountSnapshotResponse response = AccountSnapshotResponse.from(snapshotService.createSnapshot(request));
        return ResponseEntity.created(URI.create("/api/snapshots/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    public AccountSnapshotResponse updateSnapshot(@PathVariable UUID id, @Valid @RequestBody CreateAccountSnapshotRequest request) {
        return AccountSnapshotResponse.from(snapshotService.updateSnapshot(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSnapshot(@PathVariable UUID id) {
        snapshotService.deleteSnapshot(id);
    }

    @ExceptionHandler(AccountNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleAccountNotFound(AccountNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(AccountSnapshotNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleSnapshotNotFound(AccountSnapshotNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(DuplicateAccountSnapshotException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> handleDuplicateSnapshot(DuplicateAccountSnapshotException exception) {
        return Map.of("message", exception.getMessage());
    }
}
