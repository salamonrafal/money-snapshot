package com.moneysnapshot.transactionanalyzer;

import com.moneysnapshot.security.CurrentUserService;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransactionFileStorageService {

    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS")
            .withZone(ZoneOffset.UTC);
    private final Path storageDirectory;
    private final CurrentUserService currentUserService;

    public TransactionFileStorageService(
            @Value("${app.transaction-analyzer.storage-directory}") Path storageDirectory,
            CurrentUserService currentUserService
    ) {
        this.storageDirectory = storageDirectory.toAbsolutePath().normalize();
        this.currentUserService = currentUserService;
    }

    public StoredTransactionFile store(MultipartFile file) {
        String originalFilename = originalFilename(file.getOriginalFilename());
        Path directory = storageDirectory();

        try {
            Files.createDirectories(directory);
            Path temporaryFile = Files.createTempFile(directory, ".upload-", ".tmp");
            try {
                try (InputStream inputStream = file.getInputStream()) {
                    Files.copy(inputStream, temporaryFile, StandardCopyOption.REPLACE_EXISTING);
                }
                return publish(temporaryFile, directory, originalFilename);
            } finally {
                Files.deleteIfExists(temporaryFile);
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store transaction file.", exception);
        }
    }

    public List<StoredTransactionFile> list() {
        Path directory = storageDirectory();
        if (!Files.isDirectory(directory)) {
            return List.of();
        }

        try (Stream<Path> paths = Files.list(directory)) {
            return paths.filter(Files::isRegularFile)
                    .map(this::storedFile)
                    .flatMap(java.util.Optional::stream)
                    .sorted(java.util.Comparator.comparing(StoredTransactionFile::id).reversed())
                    .toList();
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not list transaction files.", exception);
        }
    }

    public DownloadedTransactionFile open(String storageFilename) {
        Path directory = storageDirectory();
        Path file = directory.resolve(storageFilename).normalize();
        if (!file.startsWith(directory) || !Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction file not found.");
        }

        StoredTransactionFile storedFile = storedFile(file)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction file not found."));
        return new DownloadedTransactionFile(storedFile, file);
    }

    private Path storageDirectory() {
        return storageDirectory.resolve(currentUserService.currentUserId().toString());
    }

    private java.util.Optional<StoredTransactionFile> storedFile(Path path) {
        String storageFilename = path.getFileName().toString();
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("^(.+)-\\d{8}-\\d{6}-\\d{3}(?:-\\d+)?(\\.[^.]+)?$")
                .matcher(storageFilename);
        if (!matcher.matches()) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(new StoredTransactionFile(storageFilename, matcher.group(1) + defaultString(matcher.group(2))));
    }

    private String originalFilename(String filename) {
        String leafName = filename == null ? "transactions.csv" : filename.replace('\\', '/');
        int separator = leafName.lastIndexOf('/');
        if (separator >= 0) {
            leafName = leafName.substring(separator + 1);
        }
        String safeName = leafName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safeName.isBlank()) {
            return "transactions.csv";
        }
        int extensionStart = safeName.lastIndexOf('.');
        String extension = extensionStart > 0 ? safeName.substring(extensionStart) : "";
        if (extension.length() > 32) {
            extension = extension.substring(0, 32);
        }
        String baseName = extensionStart > 0 ? safeName.substring(0, extensionStart) : safeName;
        return baseName.substring(0, Math.min(baseName.length(), 180 - extension.length())) + extension;
    }

    private StoredTransactionFile publish(Path temporaryFile, Path directory, String originalFilename) throws IOException {
        int extensionStart = originalFilename.lastIndexOf('.');
        String extension = extensionStart > 0 ? originalFilename.substring(extensionStart) : "";
        String baseName = extensionStart > 0 ? originalFilename.substring(0, extensionStart) : originalFilename;
        String timestamp = TIMESTAMP_FORMAT.format(now());
        for (int collision = 0; ; collision++) {
            String suffix = collision == 0 ? "" : "-" + collision;
            String storageFilename = baseName + "-" + timestamp + suffix + extension;
            Path target = directory.resolve(storageFilename);
            Path reservation = directory.resolve("." + storageFilename + ".reserve");
            try {
                Files.createFile(reservation);
            } catch (FileAlreadyExistsException exception) {
                // Another concurrent upload reserved this name; try the next suffix.
                continue;
            }

            try {
                if (Files.exists(target)) {
                    continue;
                }
                moveIntoPlace(temporaryFile, target);
                return new StoredTransactionFile(storageFilename, originalFilename);
            } catch (FileAlreadyExistsException exception) {
                // A non-cooperating writer created the target; try the next suffix.
            } finally {
                Files.deleteIfExists(reservation);
            }
        }
    }

    private void moveIntoPlace(Path temporaryFile, Path target) throws IOException {
        try {
            Files.move(temporaryFile, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(temporaryFile, target);
        }
    }

    Instant now() {
        return Instant.now();
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    public record StoredTransactionFile(String id, String originalFilename) {
    }

    public record DownloadedTransactionFile(StoredTransactionFile metadata, Path path) {
    }
}
