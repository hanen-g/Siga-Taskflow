package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.dto.skill.ProjectSkillMatchResponse;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.dto.skill.UserSkillMatchResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.taskflow.backend.dto.websocket.ProjectMessage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final UploadedFileService uploadedFileService;
    private final SkillRepository skillRepository;
    private final UserRepository userRepository;

    public ProjectService(ProjectRepository projectRepository,
                          SimpMessagingTemplate messagingTemplate,
                          UploadedFileService uploadedFileService,
                          SkillRepository skillRepository,
                          UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.messagingTemplate = messagingTemplate;
        this.uploadedFileService = uploadedFileService;
        this.skillRepository = skillRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ProjectResponse createProject(Project project) {
        project.setRequiredSkills(resolveRequiredSkills(project.getRequiredSkills()));
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
        if (user.getRole() == UserRole.CLIENT) {
            ProjectResponse response = ProjectResponse.fromProject(project);
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

        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only an administrator can change project details");
        }

        project.setName(details.getName());
        project.setDescription(details.getDescription());
        project.setDeadline(details.getDeadline());
        project.setRequiredSkills(resolveRequiredSkills(details.getRequiredSkills()));
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
    @Transactional(readOnly = true)
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
        if (manager.getRole() == UserRole.CLIENT) {
            return projectRepository.findAll().stream()
                    .filter(project -> !project.isArchived())
                    .filter(project -> userCanViewProject(project, manager))
                    .map(ProjectResponse::fromProject)
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

    private boolean canSetRequiredSkillsForProject(Project project, User user) {
        if (user.getRole() == UserRole.ADMIN) {
            return true;
        }
        if (user.getRole() == UserRole.PROJECT_MANAGER
                && project.getManager() != null
                && project.getManager().getId().equals(user.getId())) {
            return true;
        }
        return false;
    }

    @Transactional
    public ProjectResponse setRequiredSkillIds(Long projectId, List<Long> skillIdList, User actor) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (!canSetRequiredSkillsForProject(project, actor)) {
            throw new UnauthorizedException("You cannot update required skills for this project");
        }
        List<Long> unique = skillIdList == null
                ? List.of()
                : skillIdList.stream().distinct().toList();
        if (unique.isEmpty()) {
            project.setRequiredSkills(new HashSet<>());
        } else {
            List<Skill> found = skillRepository.findAllById(unique);
            if (found.size() != unique.size()) {
                throw new BadRequestException("One or more skill ids are invalid");
            }
            project.setRequiredSkills(new HashSet<>(found));
        }
        projectRepository.save(project);
        Project detailed = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(detailed));
        messagingTemplate.convertAndSend("/topic/projects", msg);
        return getProjectForUser(projectId, actor);
    }

    @Transactional(readOnly = true)
    public ProjectSkillMatchResponse getProjectSkillMatches(Long projectId, User user) {
        Project project = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (!userCanViewProject(project, user)) {
            throw new UnauthorizedException("You cannot access this project");
        }
        Set<Skill> required = project.getRequiredSkills() == null
                ? Set.of()
                : new HashSet<>(project.getRequiredSkills());
        List<SkillResponse> requiredDtos = required.stream()
                .map(SkillResponse::fromEntity)
                .sorted(Comparator.comparing(SkillResponse::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        int reqCount = requiredDtos.size();
        Set<UserRole> roles = Set.of(UserRole.PROJECT_MANAGER, UserRole.COLLABORATOR);
        List<User> candidates = userRepository.findActiveByRolesWithSkills(roles);
        List<UserSkillMatchResponse> rows = new ArrayList<>();
        for (User u : candidates) {
            Set<Long> userSkillIds = (u.getSkills() == null || u.getSkills().isEmpty())
                    ? Set.of()
                    : u.getSkills().stream().map(Skill::getId).collect(Collectors.toSet());
            List<SkillResponse> matched = new ArrayList<>();
            for (Skill s : required) {
                if (userSkillIds.contains(s.getId())) {
                    matched.add(SkillResponse.fromEntity(s));
                }
            }
            int m = matched.size();
            boolean full = reqCount == 0 || m == reqCount;
            rows.add(new UserSkillMatchResponse(
                    u.getId(),
                    u.getFirstName(),
                    u.getLastName(),
                    u.getEmail(),
                    u.getRole() == null ? "" : u.getRole().name(),
                    m,
                    reqCount,
                    full,
                    matched
            ));
        }
        if (reqCount > 0) {
            rows.removeIf(match -> match.getMatchedCount() == 0);
        }
        rows.sort(Comparator
                .comparing(UserSkillMatchResponse::isFullMatch)
                .reversed()
                .thenComparing(Comparator.comparingInt(UserSkillMatchResponse::getMatchedCount).reversed())
                .thenComparing(
                        (UserSkillMatchResponse x) -> ((x.getFirstName() == null ? "" : x.getFirstName())
                                + " " + (x.getLastName() == null ? "" : x.getLastName())).toLowerCase()
                )
        );
        return new ProjectSkillMatchResponse(requiredDtos, rows);
    }

    private Set<Skill> resolveRequiredSkills(Set<Skill> incomingSkills) {
        if (incomingSkills == null || incomingSkills.isEmpty()) {
            return new HashSet<>();
        }
        List<Long> uniqueIds = incomingSkills.stream()
                .map(Skill::getId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (uniqueIds.isEmpty()) {
            return new HashSet<>();
        }
        List<Skill> found = skillRepository.findAllById(uniqueIds);
        if (found.size() != uniqueIds.size()) {
            throw new BadRequestException("One or more selected skills are invalid.");
        }
        return new HashSet<>(found);
    }
}
