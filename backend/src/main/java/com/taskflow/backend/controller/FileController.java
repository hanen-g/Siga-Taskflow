package com.taskflow.backend.controller;

import com.taskflow.backend.dto.file.UploadedFileResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.FileStorageService;
import com.taskflow.backend.service.UploadedFileService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files")
@CrossOrigin
public class FileController {

    private final FileStorageService storageService;
    private final UploadedFileService uploadedFileService;

    public FileController(FileStorageService storageService, UploadedFileService uploadedFileService) {
        this.storageService = storageService;
        this.uploadedFileService = uploadedFileService;
    }

    @PostMapping("/upload")
    public UploadedFileResponse uploadAvatar(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return uploadedFileService.uploadUserAvatar(file, userDetails.getUser());
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<Resource> download(
            @PathVariable String filename,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        uploadedFileService.assertDownloadAccess(filename, userDetails.getUser());
        Resource resource = storageService.loadAsResource(filename);
        String originalFilename = storageService.resolveOriginalFilename(filename);
        String contentType = storageService.resolveContentType(filename);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + originalFilename + "\"")
                .body(resource);
    }

    @PostMapping("/projects/{projectId:\\d+}")
    public UploadedFileResponse uploadProjectFile(
            @PathVariable Long projectId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return uploadedFileService.uploadProjectFile(projectId, file, userDetails.getUser());
    }

    @PostMapping("/tasks/{taskId:\\d+}")
    public UploadedFileResponse uploadTaskFile(
            @PathVariable Long taskId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return uploadedFileService.uploadTaskFile(taskId, file, userDetails.getUser());
    }
}
