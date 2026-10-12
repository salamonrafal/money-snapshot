package com.moneysnapshot.transactionanalyzer.web;

import com.moneysnapshot.ApplicationEnvironmentProperties;
import com.moneysnapshot.transactionanalyzer.TransactionFileStorageService;
import com.moneysnapshot.transactionanalyzer.TransactionFileStorageService.DownloadedTransactionFile;
import com.moneysnapshot.transactionanalyzer.TransactionFileStorageService.StoredTransactionFile;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/transaction-analyzer/uploads")
public class TransactionFileUploadController {

    private final ApplicationEnvironmentProperties applicationEnvironmentProperties;
    private final TransactionFileStorageService storageService;

    public TransactionFileUploadController(
            ApplicationEnvironmentProperties applicationEnvironmentProperties,
            TransactionFileStorageService storageService
    ) {
        this.applicationEnvironmentProperties = applicationEnvironmentProperties;
        this.storageService = storageService;
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<TransactionFileResponse> upload(@RequestPart("file") MultipartFile file) {
        ensureFeatureEnabled();
        StoredTransactionFile storedFile = storageService.store(file);
        return ResponseEntity.status(HttpStatus.CREATED).body(TransactionFileResponse.from(storedFile));
    }

    @GetMapping
    public List<TransactionFileResponse> list() {
        ensureFeatureEnabled();
        return storageService.list().stream().map(TransactionFileResponse::from).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<InputStreamResource> download(@PathVariable String id) throws IOException {
        ensureFeatureEnabled();
        DownloadedTransactionFile file = storageService.open(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(Files.size(file.path()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.metadata().originalFilename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(new InputStreamResource(Files.newInputStream(file.path())));
    }

    private void ensureFeatureEnabled() {
        if (!applicationEnvironmentProperties.featureEnabled("transaction-analyzer")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }
}
