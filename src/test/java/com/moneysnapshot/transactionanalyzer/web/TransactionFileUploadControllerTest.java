package com.moneysnapshot.transactionanalyzer.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.moneysnapshot.ApplicationEnvironmentProperties;
import com.moneysnapshot.transactionanalyzer.TransactionFileStorageService;
import com.moneysnapshot.transactionanalyzer.TransactionFileAnalysisService;
import com.moneysnapshot.transactionanalyzer.TransactionFileStorageService.StoredTransactionFile;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TransactionFileUploadControllerTest {

    @Test
    void storesUploadedFile() {
        TransactionFileUploadController controller = controller(true);
        MockMultipartFile file = new MockMultipartFile("file", "historia.csv", "text/csv", "data".getBytes());

        assertEquals(HttpStatus.CREATED, controller.upload(file).getStatusCode());
        verify(storageService).store(file);
    }

    @Test
    void hidesUploadWhenFeatureIsDisabled() {
        TransactionFileUploadController controller = controller(false);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> controller.upload(new MockMultipartFile("file", "historia.csv", "text/csv", new byte[0])));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    private TransactionFileUploadController controller(boolean transactionAnalyzerEnabled) {
        storageService = mock(TransactionFileStorageService.class);
        TransactionFileAnalysisService analysisService = mock(TransactionFileAnalysisService.class);
        when(storageService.store(org.mockito.ArgumentMatchers.any())).thenReturn(
                new StoredTransactionFile("historia-20261012-142301-123.csv", "historia.csv")
        );
        return new TransactionFileUploadController(new ApplicationEnvironmentProperties(
                "test",
                Map.of("transaction-analyzer", transactionAnalyzerEnabled)
        ), storageService, analysisService);
    }

    private TransactionFileStorageService storageService;
}
