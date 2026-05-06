package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ProjectLifecycleRequest;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.taskflow.backend.dto.websocket.ProjectMessage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);

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

    /**
     * All non-archived projects (for the main admin list). Archived items are listed via
     * {@link #getAllArchivedForAdmin()} or {@link #myArchivedProjects}.
     */
    @Transactional(readOnly = true)
    public List<ProjectResponse> getAllProjects() {
        return projectRepository.findByArchived(false)
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
            ProjectResponse response = collaboratorAssignedViaTasks(project, user)
                    ? ProjectResponse.fromProject(project, task ->
                            task.getCollaborators() != null
                                    && task.getCollaborators().stream().anyMatch(c -> c.getId().equals(user.getId())))
                    : ProjectResponse.fromProject(project);
            response.setFiles(uploadedFileService.listProjectFilesForUser(project, user));
            return response;
        }
        if (user.getRole() == UserRole.CLIENT) {
            ProjectResponse response = ProjectResponse.fromProjectForClient(project);
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
        if (user.getRole() == UserRole.CLIENT) {
            if (project.isArchived()) {
                return false;
            }
            return clientCanAccessProject(project, user);
        }
        if (user.getRole() == UserRole.COLLABORATOR) {
            if (project.isArchived()) {
                return false;
            }
            return collaboratorCanAccessProject(project, user);
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
     * Client access model:
     * - direct invitation (client account is in project members), or
     * - same organization/company as an invited client account.
     */
    private boolean clientCanAccessProject(Project project, User clientUser) {
        if (clientUser == null || clientUser.getId() == null || project.getMembers() == null) {
            return false;
        }
        boolean directlyInvited = project.getMembers().stream()
                .anyMatch(member -> member != null && clientUser.getId().equals(member.getId()));
        if (directlyInvited) {
            return true;
        }
        String clientCompany = normalizeCompany(clientUser.getCompany());
        if (clientCompany == null) {
            return false;
        }
        return project.getMembers().stream()
                .filter(member -> member != null && member.getRole() == UserRole.CLIENT)
                .map(User::getCompany)
                .map(this::normalizeCompany)
                .anyMatch(clientCompany::equals);
    }

    private String normalizeCompany(String company) {
        if (company == null) {
            return null;
        }
        String normalized = company.trim().toLowerCase();
        return normalized.isEmpty() ? null : normalized;
    }

    /** Collaborator sees a project only when assigned by the PM/chef on at least one task. */
    private boolean collaboratorAssignedViaTasks(Project project, User collaborator) {
        Long id = collaborator.getId();
        if (project.getTasks() == null || id == null) {
            return false;
        }
        return project.getTasks().stream()
                .anyMatch(task -> task.getCollaborators() != null
                        && task.getCollaborators().stream().anyMatch(c -> id.equals(c.getId())));
    }

    /**
     * Collaborator may access a project when they are on the project member list (e.g. after an approved
     * proposal) or when assigned on at least one task.
     */
    private boolean collaboratorCanAccessProject(Project project, User collaborator) {
        Long id = collaborator.getId();
        if (id == null) {
            return false;
        }
        if (project.getMembers() != null
                && project.getMembers().stream().anyMatch(m -> m.getId().equals(id))) {
            return true;
        }
        return collaboratorAssignedViaTasks(project, collaborator);
    }

    /**
     * Projects listed for collaborators: non-archived, non-paused, non-delivered, and either a member or
     * assigned on a task. Future start dates stay visible so they match the “not started” column in the UI.
     */
    private boolean collaboratorSeesListableProject(Project project, User collaborator) {
        if (project.isArchived() || project.isPaused() || project.isDelivered()) {
            return false;
        }
        return collaboratorCanAccessProject(project, collaborator);
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

        boolean isAdmin = actor.getRole() == UserRole.ADMIN;
        boolean isManager = project.getManager() != null
                && project.getManager().getId().equals(actor.getId());
        if (!isAdmin && !isManager) {
            throw new UnauthorizedException("You are not allowed to update this project");
        }

        if (isAdmin) {
            applyAdminStaffingUpdates(project, details);
        }

        project.setName(details.getName());
        project.setDescription(details.getDescription());
        project.setStartDate(details.getStartDate());
        project.setDeadline(details.getDeadline());
        project.setRequiredSkills(resolveRequiredSkills(details.getRequiredSkills()));
        Project updated = projectRepository.save(project);
        publishProjectUpdatedSafely(updated.getId());
        return projectRepository.findById(updated.getId()).orElse(updated);
    }

    /**
     * Avoid failing the HTTP transaction if WebSocket broadcast raises (e.g. broker issue).
     */
    private void publishProjectUpdatedSafely(Long projectId) {
        try {
            Project fresh = projectRepository.findById(projectId).orElse(null);
            if (fresh == null) {
                return;
            }
            messagingTemplate.convertAndSend(
                    "/topic/projects",
                    new ProjectMessage("UPDATED", ProjectResponse.fromProject(fresh))
            );
        } catch (Exception ex) {
            log.warn("Could not broadcast project {} update over WebSocket: {}", projectId, ex.getMessage());
        }
    }

    public void deleteProject(Long projectId, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can delete projects");
        }
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));

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
                    .filter(project -> collaboratorSeesListableProject(project, manager))
                    .map(project -> {
                        boolean onTasks = collaboratorAssignedViaTasks(project, manager);
                        return onTasks
                                ? ProjectResponse.fromProject(project, task ->
                                        task.getCollaborators() != null
                                                && task.getCollaborators().stream()
                                                        .anyMatch(c -> c.getId().equals(manager.getId())))
                                : ProjectResponse.fromProject(project);
                    })
                    .toList();
        }
        if (manager.getRole() == UserRole.CLIENT) {
            return projectRepository.findAll().stream()
                    .filter(project -> !project.isArchived())
                    .filter(project -> userCanViewProject(project, manager))
                    .map(ProjectResponse::fromProjectForClient)
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

    @Transactional(readOnly = true)
    public List<ProjectResponse> getAllArchivedForAdmin() {
        return projectRepository.findByArchived(true)
                .stream()
                .map(ProjectResponse::fromProject)
                .toList();
    }

    @Transactional
    public ProjectResponse setArchived(Long projectId, User actor, boolean archived) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can archive or unarchive projects");
        }
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));

        project.setArchived(archived);
        Project saved = projectRepository.save(project);

        ProjectMessage msg = new ProjectMessage(archived ? "ARCHIVED" : "UNARCHIVED", ProjectResponse.fromProject(saved));
        messagingTemplate.convertAndSend("/topic/projects", msg);

        return ProjectResponse.fromProject(saved);
    }

    /**
     * Updates lifecycle fields. Only {@link UserRole#ADMIN} may call this.
     */
    @Transactional
    public ProjectResponse setProjectLifecycle(Long projectId, ProjectLifecycleRequest request, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can change project lifecycle state");
        }
        if (request == null) {
            throw new BadRequestException("Request body is required");
        }
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (request.getArchived() != null) {
            project.setArchived(request.getArchived());
        }
        if (request.getPaused() != null) {
            project.setPaused(request.getPaused());
        }
        if (request.getDelivered() != null) {
            project.setDelivered(request.getDelivered());
        }
        Project saved = projectRepository.save(project);
        ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(saved));
        messagingTemplate.convertAndSend("/topic/projects", msg);
        return ProjectResponse.fromProject(
                projectRepository.findDetailedById(projectId)
                        .orElseThrow(() -> new ResourceNotFoundException("Project", projectId))
        );
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
            SkillService.ensureNotArchived(found);
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
        if (user.getRole() == UserRole.CLIENT) {
            throw new UnauthorizedException("Clients cannot access internal team matching data");
        }
        Project project = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (!userCanViewProject(project, user)) {
            throw new UnauthorizedException("You cannot access this project");
        }
        Set<Skill> requiredRaw = project.getRequiredSkills() == null
                ? Set.of()
                : new HashSet<>(project.getRequiredSkills());
        Set<Skill> required = requiredRaw.stream()
                .filter(sk -> !sk.isArchived())
                .collect(Collectors.toSet());
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

    /**
     * Reassign project manager and/or linked client accounts (admin only).
     */
    private void applyAdminStaffingUpdates(Project project, Project details) {
        if (details.getManager() != null && details.getManager().getId() != null) {
            User newManager = userRepository.findById(details.getManager().getId())
                    .orElseThrow(() -> new BadRequestException("Manager not found."));
            if (newManager.getRole() != UserRole.PROJECT_MANAGER) {
                throw new BadRequestException("The assigned user must be a project manager.");
            }
            project.setManager(newManager);
        }
        if (details.getClientIds() != null) {
            User mgr = project.getManager();
            if (mgr == null) {
                throw new BadRequestException("Assign a project manager before linking clients.");
            }
            LinkedHashMap<Long, User> memberById = new LinkedHashMap<>();
            memberById.put(mgr.getId(), mgr);
            for (Long clientId : new LinkedHashSet<>(details.getClientIds())) {
                if (clientId == null) {
                    continue;
                }
                User clientUser = userRepository.findById(clientId)
                        .orElseThrow(() -> new BadRequestException("Client account not found for id " + clientId + "."));
                if (clientUser.getRole() != UserRole.CLIENT) {
                    throw new BadRequestException("Only users with the CLIENT role may be linked this way (id "
                            + clientId + ").");
                }
                if (!clientUser.isActive()) {
                    throw new BadRequestException("Client account id " + clientId
                            + " is inactive; activate it first or remove it from the selection.");
                }
                memberById.putIfAbsent(clientUser.getId(), clientUser);
            }
            project.setMembers(new HashSet<>(memberById.values()));
        }
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
        SkillService.ensureNotArchived(found);
        return new HashSet<>(found);
    }
}
