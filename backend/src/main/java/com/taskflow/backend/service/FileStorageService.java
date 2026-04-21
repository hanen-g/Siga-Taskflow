package com.taskflow.backend.service;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path uploadDir;

    public FileStorageService() {
        this.uploadDir = Paths.get("uploads").toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
    }

    /**
     * Stores the given file in the local filesystem and returns the URL path that
     * can be used to fetch it from the API.
     */
    public String storeFile(MultipartFile file) {
        String original = file.getOriginalFilename();
        String filename = UUID.randomUUID().toString();
        if (original != null && original.contains(".")) {
            // Sanitize the original filename to make it URL-safe
            String sanitized = original.replaceAll("[^a-zA-Z0-9.-]", "_");
            filename += "_" + sanitized;
        }

        Path target = this.uploadDir.resolve(filename);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
        // return path that the controller will serve
        return "/api/files/" + filename;
    }

    public Resource loadAsResource(String filename) {
        try {
            Path filePath = this.uploadDir.resolve(filename).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() || resource.isReadable()) {
                return resource;
            } else {
                throw new RuntimeException("File not found " + filename);
            }
        } catch (MalformedURLException e) {
            throw new RuntimeException("File not found " + filename, e);
        }
    }

    /** True if {@code filename} resolves to a regular file under {@link #uploadDir}. */
    public boolean storedFileExists(String filename) {
        if (filename == null || filename.isBlank()) {
            return false;
        }
        Path filePath = this.uploadDir.resolve(filename).normalize();
        if (!filePath.startsWith(this.uploadDir)) {
            return false;
        }
        return Files.isRegularFile(filePath);
    }

    public String resolveOriginalFilename(String storedFilename) {
        if (storedFilename == null || storedFilename.isBlank()) {
            return "download";
        }

        int separatorIndex = storedFilename.indexOf('_');
        if (separatorIndex > 0 && separatorIndex + 1 < storedFilename.length()) {
            return storedFilename.substring(separatorIndex + 1);
        }

        return storedFilename;
    }

    public String resolveContentType(String storedFilename) {
        try {
            Path filePath = this.uploadDir.resolve(storedFilename).normalize();
            String detected = Files.probeContentType(filePath);
            if (detected != null && !detected.isBlank()) {
                return detected;
            }
        } catch (IOException ignored) {
            // Fallback below when probing fails.
        }

        String fallback = URLConnection.guessContentTypeFromName(resolveOriginalFilename(storedFilename));
        return fallback != null && !fallback.isBlank() ? fallback : "application/octet-stream";
    }
}
