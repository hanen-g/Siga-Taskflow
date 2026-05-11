package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.AssigneeCandidateResponse;
import com.taskflow.backend.dto.project.ClientOptionResponse;
import com.taskflow.backend.dto.project.ClientProjectRowResponse;
import com.taskflow.backend.dto.project.ProjectLifecycleRequest;
import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.dto.skill.ProjectSkillMatchResponse;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.dto.skill.UserSkillMatchResponse;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.entity.Client;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.ClientRepository;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.taskflow.backend.dto.websocket.ProjectMessage;
import com.taskflow.backend.dto.websocket.TaskMessage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final UploadedFileService uploadedFileService;
    private final SkillRepository skillRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ClientRepository clientRepository;

    private static final List<TaskStatus> ACTIVE_ASSIGNEE_STATUSES = List.of(
            TaskStatus.IN_PROGRESS,
            TaskStatus.ON_HOLD,
            TaskStatus.IN_REVIEW
    );
    private static final String PROJECT_PAUSED_HOLD_REASON = "Project paused by admin.";

    public ProjectService(ProjectRepository projectRepository,
                          SimpMessagingTemplate messagingTemplate,
                          UploadedFileService uploadedFileService,
                          SkillRepository skillRepository,
                          TaskRepository taskRepository,
                          UserRepository userRepository,
                          ClientRepository clientRepository) {
        this.projectRepository = projectRepository;
        this.messagingTemplate = messagingTemplate;
        this.uploadedFileService = uploadedFileService;
        this.skillRepository = skillRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
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
            return project.getMembers() != null
                    && project.getMembers().stream().anyMatch(m -> m.getId().equals(user.getId()));
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
     * Projects listed for collaborators: non-archived, non-delivered, and either a member or
     * assigned on a task. Paused projects stay visible so collaborators can track on-hold work.
     * Future start dates stay visible so they match the “not started” column in the UI.
     */
    private boolean collaboratorSeesListableProject(Project project, User collaborator) {
        if (project.isArchived() || project.isDelivered()) {
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

    /**
     * Suggest assignees (collaborators and project managers) with optional filtering by task skills
     * (must be a subset of the project's required skills) and each user's active assigned workload.
     */
    @Transactional(readOnly = true)
    public List<AssigneeCandidateResponse> getAssigneeCandidates(Long projectId, List<Long> skillIds, User user) {
        Project project = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (!userCanViewProject(project, user)) {
            throw new UnauthorizedException("You cannot access this project");
        }
       if (user.getRole() != UserRole.ADMIN && !isActorManagerOfThisProject(project, user)) {
            throw new UnauthorizedException("Only the project manager or an administrator can load assignee suggestions");
        }

        List<Long> wanted = skillIds == null
                ? List.of()
                : skillIds.stream().filter(Objects::nonNull).distinct().toList();
        if (!wanted.isEmpty()) {
            Set<Long> allowed = project.getRequiredSkills() == null
                    ? Set.of()
                    : project.getRequiredSkills().stream()
                    .map(Skill::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            if (allowed.isEmpty()) {
                throw new BadRequestException("This project has no required skills; clear task skills or configure the project first.");
            }
            for (Long id : wanted) {
                if (!allowed.contains(id)) {
                    throw new BadRequestException("Task skills must be a subset of this project's required skills.");
                }
            }
        }

        Set<UserRole> roles = EnumSet.of(UserRole.COLLABORATOR, UserRole.PROJECT_MANAGER);
        List<User> candidates = userRepository.findActiveByRolesWithSkills(roles);
        List<AssigneeCandidateResponse> out = new ArrayList<>();
        for (User u : candidates) {
            if (!u.isActive()) {
                continue;
            }
            Set<Long> userSkillIds = u.getSkills() == null
                    ? Set.of()
                    : u.getSkills().stream().map(Skill::getId).filter(Objects::nonNull).collect(Collectors.toSet());
            int matched = (int) wanted.stream().filter(userSkillIds::contains).count();
            if (!wanted.isEmpty() && matched < wanted.size()) {
                continue;
            }
            long workload = taskRepository.countByCollaboratorIdAndStatusIn(u.getId(), ACTIVE_ASSIGNEE_STATUSES);
            out.add(new AssigneeCandidateResponse(
                    u.getEmail(),
                    u.getFirstName(),
                    u.getLastName(),
                    u.getRole() != null ? u.getRole().name() : "",
                    workload,
                    matched
            ));
        }
        out.sort(Comparator
                .comparingLong(AssigneeCandidateResponse::getActiveTaskCount)
                .thenComparing(AssigneeCandidateResponse::getEmail, String.CASE_INSENSITIVE_ORDER));
        return out;
    }

    /**
     * Used when creating a project (no DB row yet): list active project managers, optionally filtered so they
     * cover <strong>all</strong> requested skill ids — same matching rule as task assignee suggestions.
     * Sorted by ascending active-task workload then email.
     */
    @Transactional(readOnly = true)
    public List<AssigneeCandidateResponse> listProjectManagerCandidatesForAdmin(List<Long> skillIds, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can load project manager candidates");
        }

        List<Long> wanted = skillIds == null
                ? List.of()
                : skillIds.stream().filter(Objects::nonNull).distinct().toList();

        Set<UserRole> roles = EnumSet.of(UserRole.PROJECT_MANAGER);
        List<User> candidates = userRepository.findActiveByRolesWithSkills(roles);
        List<AssigneeCandidateResponse> out = new ArrayList<>();
        for (User u : candidates) {
            if (!u.isActive()) {
                continue;
            }
            Set<Long> userSkillIds = u.getSkills() == null
                    ? Set.of()
                    : u.getSkills().stream().map(Skill::getId).filter(Objects::nonNull).collect(Collectors.toSet());
            int matched = (int) wanted.stream().filter(userSkillIds::contains).count();
            if (!wanted.isEmpty() && matched < wanted.size()) {
                continue;
            }
            long workload = taskRepository.countByCollaboratorIdAndStatusIn(u.getId(), ACTIVE_ASSIGNEE_STATUSES);
            out.add(new AssigneeCandidateResponse(
                    u.getEmail(),
                    u.getFirstName(),
                    u.getLastName(),
                    u.getRole() != null ? u.getRole().name() : "",
                    workload,
                    matched
            ));
        }
        out.sort(Comparator
                .comparingLong(AssigneeCandidateResponse::getActiveTaskCount)
                .thenComparing(c -> c.getEmail() != null ? c.getEmail() : "", String.CASE_INSENSITIVE_ORDER));
        return out;
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

        project.setName(details.getName());
        project.setDescription(details.getDescription());
        project.setStartDate(details.getStartDate());
        project.setDeadline(details.getDeadline());
        project.setRequiredSkills(resolveRequiredSkills(details.getRequiredSkills()));
        Project updated = projectRepository.save(project);
        ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(updated));
        messagingTemplate.convertAndSend("/topic/projects", msg);
        return updated;
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
        Project project = projectRepository.findDetailedById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (request.getArchived() != null) {
            project.setArchived(request.getArchived());
        }
        if (request.getPaused() != null) {
            project.setPaused(request.getPaused());
            if (request.getPaused()) {
                pauseUnfinishedTasks(project);
            }
        }
        if (request.getDelivered() != null) {
            if (request.getDelivered() && !isReadyForDelivery(project)) {
                throw new BadRequestException("All project tasks must be done before delivery.");
            }
            project.setDelivered(request.getDelivered());
        }
        Project saved = projectRepository.save(project);
        if (request.getPaused() != null && request.getPaused()) {
            broadcastTaskUpdates(project.getTasks());
        }
        ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(saved));
        messagingTemplate.convertAndSend("/topic/projects", msg);
        return ProjectResponse.fromProject(
                projectRepository.findDetailedById(projectId)
                        .orElseThrow(() -> new ResourceNotFoundException("Project", projectId))
        );
    }

    private boolean isReadyForDelivery(Project project) {
        List<Task> tasks = project.getTasks() != null ? project.getTasks() : List.of();
        return !tasks.isEmpty() && tasks.stream()
                .allMatch(task -> task != null && task.getStatus() == TaskStatus.DONE);
    }

    private void pauseUnfinishedTasks(Project project) {
        if (project.getTasks() == null) {
            return;
        }
        for (Task task : project.getTasks()) {
            if (task == null || task.getStatus() == TaskStatus.DONE) {
                continue;
            }
            task.setStatus(TaskStatus.ON_HOLD);
            if (task.getHoldReason() == null || task.getHoldReason().isBlank()) {
                task.setHoldReason(PROJECT_PAUSED_HOLD_REASON);
            }
        }
    }

    private void broadcastTaskUpdates(List<Task> tasks) {
        if (tasks == null) {
            return;
        }
        for (Task task : tasks) {
            if (task == null || task.getId() == null || task.getProject() == null || task.getStatus() != TaskStatus.ON_HOLD) {
                continue;
            }
            TaskMessage msg = new TaskMessage("UPDATED", TaskResponse.fromTask(task));
            messagingTemplate.convertAndSend("/topic/tasks/project/" + task.getProject().getId(), msg);
            if (task.getCollaborators() == null) {
                continue;
            }
            for (User collaborator : task.getCollaborators()) {
                if (collaborator != null && collaborator.getId() != null) {
                    messagingTemplate.convertAndSend("/topic/tasks/user/" + collaborator.getId(), msg);
                }
            }
        }
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
        UserRole actorRole = user.getRole();
        if (actorRole != UserRole.ADMIN && actorRole != UserRole.PROJECT_MANAGER) {
            throw new UnauthorizedException("You cannot access team skill matches for this project");
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
        Set<UserRole> candidateRoles = actorRole == UserRole.ADMIN
                ? Set.of(UserRole.PROJECT_MANAGER)
                : Set.of(UserRole.COLLABORATOR);
        List<User> candidates = userRepository.findActiveByRolesWithSkills(candidateRoles);
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

    private boolean isActorManagerOfThisProject(Project project, User user) {
        if (project.getManager() == null) {
            return false;
        }
        User mgr = project.getManager();
        if (user.getId() != null && mgr.getId() != null && Objects.equals(mgr.getId(), user.getId())) {
            return true;
        }
        String ue = user.getEmail();
        String me = mgr.getEmail();
        return ue != null && me != null && ue.trim().equalsIgnoreCase(me.trim());
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

    /** Non-archived projects where the user is in {@link Project#getMembers()} (admin only). */
    @Transactional(readOnly = true)
    public List<ClientProjectRowResponse> listProjectsForClient(Long clientId, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can list client projects");
        }
        User client = userRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("User", clientId));
        if (client.getRole() != UserRole.CLIENT) {
            throw new BadRequestException("User is not a client account.");
        }
        return projectRepository.findByMembersContainingAndArchived(client, false).stream()
                .sorted(Comparator
                        .comparing(Project::getDeadline, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed()
                        .thenComparing(p -> p.getName() == null ? "" : p.getName(),
                                String.CASE_INSENSITIVE_ORDER))
                .map(p -> new ClientProjectRowResponse(p.getId(), p.getName(), p.getDeadline()))
                .toList();
    }

    /**
     * Adds a client to each project's members set (non-archived projects only).
     * Idempotent for duplicate membership.
     */
    @Transactional
    public void addClientToProjects(Long clientId, List<Long> projectIds, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can assign clients to projects");
        }
        User client = userRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("User", clientId));
        if (client.getRole() != UserRole.CLIENT) {
            throw new BadRequestException("User is not a client account.");
        }
        if (projectIds == null || projectIds.isEmpty()) {
            return;
        }
        List<Long> uniqueIds = projectIds.stream().filter(Objects::nonNull).distinct().toList();
        for (Long pid : uniqueIds) {
            Project project = projectRepository.findById(pid)
                    .orElseThrow(() -> new ResourceNotFoundException("Project", pid));
            if (project.isArchived()) {
                throw new BadRequestException("Cannot add clients to an archived project.");
            }
            if (project.getMembers() == null) {
                project.setMembers(new HashSet<>());
            }
            project.getMembers().add(client);
            Project saved = projectRepository.save(project);
            projectRepository.findDetailedById(saved.getId()).ifPresent(detailed -> {
                ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(detailed));
                messagingTemplate.convertAndSend("/topic/projects", msg);
            });
        }
    }

    /**
     * Replaces the full set of (non-archived) projects this client belongs to. Archived projects
     * are not touched. The client is added to projects in the new list and removed from any prior
     * non-archived project not in the list.
     */
    @Transactional
    public void replaceClientProjects(Long clientId, List<Long> projectIds, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can assign clients to projects");
        }
        User client = userRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("User", clientId));
        if (client.getRole() != UserRole.CLIENT) {
            throw new BadRequestException("User is not a client account.");
        }

        Set<Long> targetIds = projectIds == null
                ? new HashSet<>()
                : projectIds.stream().filter(Objects::nonNull).collect(Collectors.toCollection(HashSet::new));

        List<Project> affected = new ArrayList<>();
        if (!targetIds.isEmpty()) {
            for (Long pid : targetIds) {
                Project project = projectRepository.findById(pid)
                        .orElseThrow(() -> new ResourceNotFoundException("Project", pid));
                if (project.isArchived()) {
                    throw new BadRequestException("Cannot add clients to an archived project.");
                }
                if (project.getMembers() == null) {
                    project.setMembers(new HashSet<>());
                }
                if (project.getMembers().stream().noneMatch(m -> m.getId().equals(client.getId()))) {
                    project.getMembers().add(client);
                    affected.add(projectRepository.save(project));
                }
            }
        }

        for (Project current : projectRepository.findByMembersContainingAndArchived(client, false)) {
            if (targetIds.contains(current.getId())) {
                continue;
            }
            current.getMembers().removeIf(m -> m.getId().equals(client.getId()));
            affected.add(projectRepository.save(current));
        }

        for (Project saved : affected) {
            projectRepository.findDetailedById(saved.getId()).ifPresent(detailed -> {
                ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(detailed));
                messagingTemplate.convertAndSend("/topic/projects", msg);
            });
        }
    }

    /**
     * Lists clients currently assigned to a project. Admins only.
     */
    @Transactional(readOnly = true)
    public List<ClientOptionResponse> listClientsForProject(Long projectId, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can list project clients");
        }
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException("Project", projectId);
        }
        List<User> clients = projectRepository.findMembersByProjectIdAndRole(projectId, UserRole.CLIENT);
        return mapClientsToOptions(clients);
    }

    /**
     * Replaces the full set of client members on a project. Other members (manager, collaborators)
     * are not affected. Cannot run on archived projects.
     */
    @Transactional
    public void setProjectClients(Long projectId, List<Long> clientIds, User actor) {
        if (actor.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only administrators can change project clients");
        }
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project", projectId));
        if (project.isArchived()) {
            throw new BadRequestException("Cannot change clients on an archived project.");
        }

        Set<Long> wanted = clientIds == null
                ? new HashSet<>()
                : clientIds.stream().filter(Objects::nonNull).collect(Collectors.toCollection(HashSet::new));

        List<User> resolved = new ArrayList<>();
        if (!wanted.isEmpty()) {
            resolved = userRepository.findAllById(wanted);
            if (resolved.size() != wanted.size()) {
                throw new BadRequestException("One or more selected clients are invalid.");
            }
            for (User u : resolved) {
                if (u.getRole() != UserRole.CLIENT) {
                    throw new BadRequestException("Selected user is not a client account: " + u.getEmail());
                }
            }
        }

        if (project.getMembers() == null) {
            project.setMembers(new HashSet<>());
        }
        project.getMembers().removeIf(m -> m.getRole() == UserRole.CLIENT && !wanted.contains(m.getId()));
        for (User client : resolved) {
            if (project.getMembers().stream().noneMatch(m -> m.getId().equals(client.getId()))) {
                project.getMembers().add(client);
            }
        }

        Project saved = projectRepository.save(project);
        projectRepository.findDetailedById(saved.getId()).ifPresent(detailed -> {
            ProjectMessage msg = new ProjectMessage("UPDATED", ProjectResponse.fromProject(detailed));
            messagingTemplate.convertAndSend("/topic/projects", msg);
        });
    }

    private List<ClientOptionResponse> mapClientsToOptions(List<User> clients) {
        if (clients == null || clients.isEmpty()) {
            return List.of();
        }
        Map<Long, Client> profiles = clientProfileMapForUsers(clients);
        return clients.stream()
                .sorted(Comparator
                        .comparing((User u) -> {
                            Client cp = profiles.get(u.getId());
                            String company = cp == null || cp.getCompanyName() == null ? "" : cp.getCompanyName();
                            return company.toLowerCase(Locale.ROOT);
                        })
                        .thenComparing(u -> ((u.getFirstName() == null ? "" : u.getFirstName())
                                + " " + (u.getLastName() == null ? "" : u.getLastName())).toLowerCase(Locale.ROOT)))
                .map(u -> {
                    Client cp = profiles.get(u.getId());
                    return new ClientOptionResponse(
                            u.getId(),
                            u.getFirstName(),
                            u.getLastName(),
                            u.getEmail(),
                            cp == null ? null : cp.getCompanyName()
                    );
                })
                .toList();
    }

    private Map<Long, Client> clientProfileMapForUsers(List<User> users) {
        List<Long> clientIds = users.stream()
                .filter(u -> u.getRole() == UserRole.CLIENT)
                .map(User::getId)
                .filter(Objects::nonNull)
                .toList();
        if (clientIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Client> map = new LinkedHashMap<>();
        for (Client cp : clientRepository.findAllByUser_IdIn(clientIds)) {
            map.put(cp.getUser().getId(), cp);
        }
        return map;
    }
}
