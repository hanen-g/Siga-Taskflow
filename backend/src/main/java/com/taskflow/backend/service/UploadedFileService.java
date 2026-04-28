package com.taskflow.backend.service;

import com.taskflow.backend.dto.file.UploadedFileResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.UploadedFile;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UploadedFileRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UploadedFileService {

    private final UploadedFileRepository uploadedFileRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    @Transactional
    public UploadedFileResponse uploadProjectFile(Long projectId, MultipartFile file, User actor) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));

        boolean canUpload = actor.getRole() == UserRole.ADMIN
                || (project.getManager() != null && project.getManager().getId().equals(actor.getId()));
        if (!canUpload) {
            throw new UnauthorizedException("Only the project manager can upload files to this project");
        }

        String url = fileStorageService.storeFile(file);
        UploadedFile uploaded = new UploadedFile();
        uploaded.setFileUrl(url);
        uploaded.setOriginalFileName(safeOriginalName(file));
        uploaded.setUploadedBy(actor);
        uploaded.setProject(project);
        uploaded.setTask(null);
        return UploadedFileResponse.fromEntity(uploadedFileRepository.save(uploaded));
    }

    /**
     * Stores a file for the current user's profile picture (no project/task scope).
     */
    @Transactional
    public UploadedFileResponse uploadUserAvatar(MultipartFile file, User actor) {
        String url = fileStorageService.storeFile(file);
        UploadedFile uploaded = new UploadedFile();
        uploaded.setFileUrl(url);
        uploaded.setOriginalFileName(safeOriginalName(file));
        uploaded.setUploadedBy(actor);
        uploaded.setProject(null);
        uploaded.setTask(null);
        return UploadedFileResponse.fromEntity(uploadedFileRepository.save(uploaded));
    }

    @Transactional
    public UploadedFileResponse uploadTaskFile(Long taskId, MultipartFile file, User actor) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", taskId));

        if (!canUploadToTask(task, actor)) {
            throw new UnauthorizedException("You cannot upload files to this task");
        }

        String url = fileStorageService.storeFile(file);
        UploadedFile uploaded = new UploadedFile();
        uploaded.setFileUrl(url);
        uploaded.setOriginalFileName(safeOriginalName(file));
        uploaded.setUploadedBy(actor);
        uploaded.setProject(task.getProject());
        uploaded.setTask(task);
        return UploadedFileResponse.fromEntity(uploadedFileRepository.save(uploaded));
    }

    @Transactional(readOnly = true)
    public List<UploadedFileResponse> listProjectFilesForUser(Project project, User user) {
        if (!canAccessProject(project, user)) {
            throw new UnauthorizedException("You cannot access files for this project");
        }

        List<UploadedFile> allFiles = uploadedFileRepository.findByProjectIdOrderByUploadedAtDesc(project.getId());
        if (user.getRole() == UserRole.ADMIN
                || (project.getManager() != null && project.getManager().getId().equals(user.getId()))) {
            return allFiles.stream().map(UploadedFileResponse::fromEntity).toList();
        }

        Set<Long> assignedTaskIds = new HashSet<>();
        if (project.getTasks() != null) {
            for (Task task : project.getTasks()) {
                if (task.getCollaborators() != null
                        && task.getCollaborators().stream().anyMatch(c -> c.getId().equals(user.getId()))) {
                    assignedTaskIds.add(task.getId());
                }
            }
        }

        return allFiles.stream()
                .filter(file -> file.getTask() == null || assignedTaskIds.contains(file.getTask().getId()))
                .map(UploadedFileResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public void assertDownloadAccess(String storedFilename, User user) {
        String fileUrl = "/api/files/" + storedFilename;
        Optional<UploadedFile> uploadedOpt = uploadedFileRepository.findByFileUrl(fileUrl);

        if (uploadedOpt.isPresent()) {
            UploadedFile file = uploadedOpt.get();
            Project project = file.getProject();
            if (project == null) {
                if (user.getRole() == UserRole.ADMIN) {
                    return;
                }
                if (file.getUploadedBy() != null && file.getUploadedBy().getId().equals(user.getId())) {
                    return;
                }
                throw new UnauthorizedException("You cannot access this file");
            }

            if (!canAccessProject(project, user)) {
                throw new UnauthorizedException("You cannot access this file");
            }

            if (file.getTask() != null && user.getRole() == UserRole.COLLABORATOR) {
                boolean assigned = file.getTask().getCollaborators() != null
                        && file.getTask().getCollaborators().stream().anyMatch(c -> c.getId().equals(user.getId()));
                if (!assigned) {
                    throw new UnauthorizedException("You cannot access this task file");
                }
            }
            return;
        }

        // No uploaded_files row (legacy profile saves, partial failures, etc.)
        if (!fileStorageService.storedFileExists(storedFilename)) {
            throw new ResourceNotFoundException("File", storedFilename);
        }

        if (user.getRole() == UserRole.ADMIN) {
            return;
        }

        User current = userRepository.findById(user.getId())
                .orElseThrow(() -> new UnauthorizedException("You cannot access this file"));
        if (profilePictureRefsStoredFile(current.getProfilePicture(), storedFilename)) {
            return;
        }

        throw new ResourceNotFoundException("File", storedFilename);
    }

 
    private boolean profilePictureRefsStoredFile(String profilePicture, String storedFilename) {
        if (profilePicture == null || profilePicture.isBlank()) {
            return false;
        }
        String canonical = "/api/files/" + storedFilename;
        return canonical.equals(normalizeProfilePictureToApiPath(profilePicture.trim()));
    }

    private static String normalizeProfilePictureToApiPath(String value) {
        if (value.startsWith("http://") || value.startsWith("https://")) {
            int idx = value.indexOf("/api/files/");
            if (idx >= 0) {
                return value.substring(idx);
            }
        }
        if (value.startsWith("/api/files/")) {
            return value;
        }
        if (value.startsWith("api/files/")) {
            return "/" + value;
        }
        if (!value.contains("/")) {
            return "/api/files/" + value;
        }
        return value;
    }

    private boolean canAccessProject(Project project, User user) {
        if (user.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (project.getManager() != null && project.getManager().getId().equals(user.getId())) {
            return true;
        }
        if (project.getMembers() != null && project.getMembers().stream().anyMatch(m -> m.getId().equals(user.getId()))) {
            return true;
        }
        return project.getTasks() != null && project.getTasks().stream().anyMatch(task ->
                task.getCollaborators() != null
                        && task.getCollaborators().stream().anyMatch(c -> c.getId().equals(user.getId()))
        );
    }

    private boolean canUploadToTask(Task task, User actor) {
        if (task.getProject() != null
                && task.getProject().getManager() != null
                && task.getProject().getManager().getId().equals(actor.getId())) {
            return true;
        }
        return task.getCollaborators() != null
                && task.getCollaborators().stream().anyMatch(c -> c.getId().equals(actor.getId()));
    }

    private String safeOriginalName(MultipartFile file) {
        String name = file.getOriginalFilename();
        return (name == null || name.isBlank()) ? "uploaded-file" : name;
    }
}
