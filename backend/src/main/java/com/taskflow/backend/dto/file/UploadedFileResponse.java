package com.taskflow.backend.dto.file;

import com.taskflow.backend.entity.UploadedFile;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
public class UploadedFileResponse {
    private Long id;
    private String fileUrl;
    private String originalFileName;
    private LocalDateTime uploadedAt;
    private Long uploadedById;
    private String uploadedByEmail;
    private String uploadedByName;
    private Long projectId;
    private Long taskId;
    private String taskTitle;
    private String scope;

    public static UploadedFileResponse fromEntity(UploadedFile entity) {
        String fullName = "";
        if (entity.getUploadedBy() != null) {
            String first = entity.getUploadedBy().getFirstName() != null ? entity.getUploadedBy().getFirstName() : "";
            String last = entity.getUploadedBy().getLastName() != null ? entity.getUploadedBy().getLastName() : "";
            fullName = (first + " " + last).trim();
        }

        return new UploadedFileResponse(
                entity.getId(),
                entity.getFileUrl(),
                entity.getOriginalFileName(),
                entity.getUploadedAt(),
                entity.getUploadedBy() != null ? entity.getUploadedBy().getId() : null,
                entity.getUploadedBy() != null ? entity.getUploadedBy().getEmail() : null,
                fullName.isBlank() ? (entity.getUploadedBy() != null ? entity.getUploadedBy().getEmail() : null) : fullName,
                entity.getProject() != null ? entity.getProject().getId() : null,
                entity.getTask() != null ? entity.getTask().getId() : null,
                entity.getTask() != null ? entity.getTask().getTitle() : null,
                entity.getTask() != null
                        ? "TASK"
                        : (entity.getProject() != null ? "PROJECT" : "USER")
        );
    }
}
