package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.ProjectRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.taskflow.backend.dto.websocket.ProjectMessage;

import java.util.List;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final UploadedFileService uploadedFileService;

    public ProjectService(ProjectRepository projectRepository,
                          SimpMessagingTemplate messagingTemplate,
                          UploadedFileService uploadedFileService) {
        this.projectRepository = projectRepository;
        this.messagingTemplate = messagingTemplate;
        this.uploadedFileService = uploadedFileService;
    }

    @Transactional
    public ProjectResponse createProject(Project project) {
        Project saved = projectRepository.save(project);
        ProjectMessage msg = new ProjectMessage("CREATED", ProjectResponse.fromProject(saved));
        messagingTemplate.convertAndSend("/topic/projects", msg);
        return ProjectResponse.fromProject(saved);
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> getAllProjects() {
        return projectRepository.findAll()
                .stream()
                .map(ProjectResponse::fromProject)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProjectForUser(Long id, User user) {
        Project project = projectRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));
        if (!userCanViewProject(project, user)) {
            throw new UnauthorizedException("You cannot access this project");
        }
        if (user.getRole() == UserRole.COLLABORATOR) {
            ProjectResponse response = ProjectResponse.fromProject(project, task ->
                    task.getCollaborators() != null
                            && task.getCollaborators().stream().anyMatch(c -> c.getId().equals(user.getId()))
            );
            response.setFiles(uploadedFileService.listProjectFilesForUser(project, user));
            return response;
        }
        ProjectResponse response = ProjectResponse.fromProject(project);
        response.setFiles(uploadedFileService.listProjectFilesForUser(project, user));
        return response;
    }

    private boolean userCanViewProject(Project project, User user) {
        if (user.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (project.getManager() != null && project.getManager().getId().equals(user.getId())) {
            return true;
        }
        if (project.getMembers() != null
                && project.getMembers().stream().anyMatch(m -> m.getId().equals(user.getId()))) {
            return true;
        }
        if (project.getTasks() != null) {
            for (Task task : project.getTasks()) {
                if (task.getCollaborators() != null
                        && task.getCollaborators().stream().anyMatch(c -> c.getId().equals(user.getId()))) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Ensures the user may read project-scoped data (e.g. task lists for that project).
     */
    @Transactional(readOnly = true)
    public void assertUserCanViewProject(Long projectId, User user) {
        Project project = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (!userCanViewProject(project, user)) {
            throw new UnauthorizedException("You cannot access this project");
        }
    }

    public List<Project> getProjectsForManager(User manager) {
        return projectRepository.findByManager(manager);
    }
    @Transactional
    public Project updateProject(Long id, Project details, User actor) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project", id));

        if (project.getManager() == null || !project.getManager().getId().equals(actor.getId())) {
            throw new UnauthorizedException("You are not the manager of this project");
        }

        project.setName(details.getName());
        project.setDescription(details.getDescription());
        project.setDeadline(details.getDeadline());
        Project updated = projectRepository.save(project);
        ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(updated));
        messagingTemplate.convertAndSend("/topic/projects", msg);
        return updated;
    }

    public void deleteProject(Long projectId, User manager) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (!project.getManager().getId().equals(manager.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        ProjectMessage msg = new ProjectMessage("DELETED", ProjectResponse.fromProject(project));
        messagingTemplate.convertAndSend("/topic/projects", msg);

        projectRepository.delete(project);
    }
    public List<ProjectResponse> myProjects(User manager) {
        if (manager.getRole() == UserRole.ADMIN) {
            return projectRepository.findByArchived(false).stream()
                    .map(ProjectResponse::fromProject)
                    .toList();
        }
        if (manager.getRole() == UserRole.COLLABORATOR) {
            return projectRepository.findAll().stream()
                    .filter(project -> !project.isArchived())
                    .filter(project -> userCanViewProject(project, manager))
                    .map(project -> ProjectResponse.fromProject(project, task ->
                            task.getCollaborators() != null
                                    && task.getCollaborators().stream().anyMatch(c -> c.getId().equals(manager.getId()))
                    ))
                    .toList();
        }
        return projectRepository.findByManagerAndArchived(manager, false)
                .stream()
                .map(ProjectResponse::fromProject)
                .toList();
    }

    public List<ProjectResponse> myArchivedProjects(User manager) {
        return projectRepository.findByManagerAndArchived(manager, true)
                .stream()
                .map(ProjectResponse::fromProject)
                .toList();
    }

    public ProjectResponse setArchived(Long projectId, User manager, boolean archived) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (!project.getManager().getId().equals(manager.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        project.setArchived(archived);
        Project saved = projectRepository.save(project);

        ProjectMessage msg = new ProjectMessage(archived ? "ARCHIVED" : "UNARCHIVED", ProjectResponse.fromProject(saved));
        messagingTemplate.convertAndSend("/topic/projects", msg);

        return ProjectResponse.fromProject(saved);
    }

    public ProjectResponse addAttachment(Long projectId, MultipartFile file, User user) {
        uploadedFileService.uploadProjectFile(projectId, file, user);
        Project project = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(project));
        messagingTemplate.convertAndSend("/topic/projects", msg);
        return getProjectForUser(projectId, user);
    }
}
