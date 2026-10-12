package com.moneysnapshot.transactionanalyzer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.moneysnapshot.security.CurrentUserService;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

class TransactionFileStorageServiceTest {

    @TempDir
    Path storageDirectory;

    @Test
    void storesListsAndOpensFilesInCurrentUsersDirectory() throws Exception {
        CurrentUserService currentUserService = org.mockito.Mockito.mock(CurrentUserService.class);
        UUID userId = UUID.randomUUID();
        when(currentUserService.currentUserId()).thenReturn(userId);
        TransactionFileStorageService service = new TransactionFileStorageService(storageDirectory, currentUserService);

        TransactionFileStorageService.StoredTransactionFile stored = service.store(
                new MockMultipartFile("file", "historia.csv", "text/csv", "date,kwota\\n2026-01-01,10".getBytes())
        );

        assertEquals("historia.csv", stored.originalFilename());
        assertEquals(java.util.List.of(stored), service.list());
        assertEquals("date,kwota\\n2026-01-01,10", Files.readString(service.open(stored.id()).path()));
        assertTrue(stored.id().matches("historia-\\d{8}-\\d{6}-\\d{3}\\.csv"));
        assertTrue(Files.isRegularFile(storageDirectory.resolve(userId.toString()).resolve(stored.id())));
    }

    @Test
    void doesNotPublishPartialFileWhenCopyFails() throws Exception {
        CurrentUserService currentUserService = org.mockito.Mockito.mock(CurrentUserService.class);
        UUID userId = UUID.randomUUID();
        when(currentUserService.currentUserId()).thenReturn(userId);
        TransactionFileStorageService service = new TransactionFileStorageService(storageDirectory, currentUserService);
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);
        when(file.getOriginalFilename()).thenReturn("historia.csv");
        when(file.getInputStream()).thenReturn(new InputStream() {
            private boolean firstByte = true;

            @Override
            public int read() throws IOException {
                if (firstByte) {
                    firstByte = false;
                    return 'x';
                }
                throw new IOException("copy failed");
            }
        });

        assertThrows(ResponseStatusException.class, () -> service.store(file));

        assertTrue(service.list().isEmpty());
        try (var files = Files.list(storageDirectory.resolve(userId.toString()))) {
            assertEquals(0, files.count());
        }
    }

    @Test
    void usesSuffixWhenTimestampFilenameIsAlreadyReserved() throws Exception {
        CurrentUserService currentUserService = org.mockito.Mockito.mock(CurrentUserService.class);
        UUID userId = UUID.randomUUID();
        when(currentUserService.currentUserId()).thenReturn(userId);
        Instant instant = Instant.parse("2026-01-02T03:04:05.678Z");
        TransactionFileStorageService service = new TransactionFileStorageService(storageDirectory, currentUserService) {
            @Override
            Instant now() {
                return instant;
            }
        };
        Path userDirectory = storageDirectory.resolve(userId.toString());
        Files.createDirectories(userDirectory);
        Files.writeString(userDirectory.resolve("historia-20260102-030405-678.csv"), "first");

        TransactionFileStorageService.StoredTransactionFile stored = service.store(
                new MockMultipartFile("file", "historia.csv", "text/csv", "second".getBytes())
        );

        assertEquals("historia-20260102-030405-678-1.csv", stored.id());
        assertEquals("second", Files.readString(userDirectory.resolve(stored.id())));
    }
}
