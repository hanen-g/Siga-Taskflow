package com.taskflow.backend.service;

import com.taskflow.backend.dto.task.TaskRequest;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.dto.task.TaskStatusUpdateRequest;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.Priority;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.dto.websocket.TaskMessage;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final SkillRepository skillRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;


    public Task createTask(TaskRequest request, User manager) {

        Project project = projectRepository.findDetailedById(request.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Project", request.getProjectId()));

        if (!project.getManager().getId().equals(manager.getId())) {
            throw new UnauthorizedException("You are not the manager of this project");
        }

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setProject(project);
        task.setCollaborators(resolveCollaborators(request));
        task.setSkills(resolveTaskSkillsFromRequest(project, request.getSkillIds()));
        task.setStatus(TaskStatus.TODO);
        if (request.getPriority() != null) {
            task.setPriority(Priority.valueOf(request.getPriority()));
        }
        task.setDeadline(request.getDeadline());

        Task saved = taskRepository.save(task);

        // broadcast to any listeners of this project's task list
        TaskMessage msg = new TaskMessage("CREATED", TaskResponse.fromTask(saved));
        messagingTemplate.convertAndSend("/topic/tasks/project/" + project.getId(), msg);

        // notify the assigned collaborators specifically
        for (User collab : task.getCollaborators()) {
            Notification notif = notificationService.createTaskAssignedNotification(collab, manager, saved);
            messagingTemplate.convertAndSend("/topic/notifications/user/" + collab.getId(), notif);

            // inform collaborator-specific task channel as well (useful if they are viewing their list)
            messagingTemplate.convertAndSend("/topic/tasks/user/" + collab.getId(), msg);
        }

        return saved;
    }

    public TaskResponse updateTask(Long taskId, TaskRequest request, User manager) {

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", taskId));

        // Verify the manager owns the project this task belongs to
        if (!task.getProject().getManager().getId().equals(manager.getId())) {
            throw new UnauthorizedException("You are not the manager of this project");
        }

        // Update basic fields if provided
        if (request.getTitle() != null) {
            task.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            task.setDescription(request.getDescription());
        }
        if (request.getPriority() != null) {
            task.setPriority(Priority.valueOf(request.getPriority()));
        }
        if (request.getDeadline() != null) {
            task.setDeadline(request.getDeadline());
        }

        Set<Long> existingCollaboratorIds = task.getCollaborators() == null
                ? Set.of()
                : task.getCollaborators().stream()
                .map(User::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (hasCollaboratorUpdate(request)) {
            task.setCollaborators(resolveCollaborators(request));
        }

        if (request.getSkillIds() != null) {
            Project detailed = projectRepository.findDetailedById(task.getProject().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Project", task.getProject().getId()));
            task.setSkills(resolveTaskSkillsFromRequest(detailed, request.getSkillIds()));
        }

        Task saved = taskRepository.save(task);

        // Broadcast the update via WebSocket
        TaskMessage msg = new TaskMessage("UPDATED", TaskResponse.fromTask(saved));
        messagingTemplate.convertAndSend("/topic/tasks/project/" + saved.getProject().getId(), msg);

        for (User collab : saved.getCollaborators()) {
            if (!existingCollaboratorIds.contains(collab.getId())) {
                Notification notif = notificationService.createTaskAssignedNotification(collab, manager, saved);
                messagingTemplate.convertAndSend("/topic/notifications/user/" + collab.getId(), notif);
            }
            messagingTemplate.convertAndSend("/topic/tasks/user/" + collab.getId(), msg);
        }

        return TaskResponse.fromTask(saved);
    }

    public List<TaskResponse> getTasksByProject(Long projectId, User user) {
        projectService.assertUserCanViewProject(projectId, user);
        var tasks = taskRepository.findByProjectId(projectId);
        if (user.getRole() == UserRole.CLIENT) {
            return tasks.stream().map(TaskResponse::fromTaskForClient).toList();
        }
        return tasks.stream().map(TaskResponse::fromTask).toList();
    }

    public void deleteTask(Long taskId, User user) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", taskId));
        if (!task.getProject().getManager().getId().equals(user.getId())) {
            throw new UnauthorizedException("You are not the manager of this project");
        }
        TaskMessage msg = new TaskMessage("DELETED", TaskResponse.fromTask(task));
        messagingTemplate.convertAndSend("/topic/tasks/project/" + task.getProject().getId(), msg);
        if (task.getCollaborators() != null) {
            for (User collab : task.getCollaborators()) {
                messagingTemplate.convertAndSend("/topic/tasks/user/" + collab.getId(), msg);
            }
        }
        taskRepository.deleteById(taskId);
    }

    /**
     * Tasks visible in global / cross-project views for the current user:
     * admin — all tasks; project manager — tasks on managed projects; collaborator — assigned tasks;
     * client — none (use per-project task APIs).
     */
    public List<TaskResponse> listTasksForCurrentUser(User user) {
        UserRole role = user.getRole();
        if (role == null) {
            throw new UnauthorizedException("This account has no role assigned.");
        }
        return switch (role) {
            case ADMIN -> taskRepository.findAllFetchingProject().stream()
                    .map(TaskResponse::fromTask)
                    .toList();
            case PROJECT_MANAGER -> taskRepository.findByProjectManager(user).stream()
                    .map(TaskResponse::fromTask)
                    .toList();
            case COLLABORATOR -> taskRepository.findByCollaboratorsContaining(user).stream()
                    .map(TaskResponse::fromTask)
                    .toList();
            case CLIENT -> List.of();
        };
    }

    public TaskResponse updateStatus(Long taskId, TaskStatusUpdateRequest request, User user) {

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", taskId));

        if (!isAssignedToTask(task, user)) {
            throw new UnauthorizedException("You are not assigned to this task");
        }

        if (request == null || request.getStatus() == null || request.getStatus().isBlank()) {
            throw new BadRequestException("Status is required");
        }

        TaskStatus nextStatus;
        try {
            nextStatus = TaskStatus.valueOf(request.getStatus().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid task status: " + request.getStatus());
        }

        validateCollaboratorTransition(nextStatus);
        applyHoldReasonRules(task, nextStatus, request.getHoldReason());

        task.setStatusBeforeProjectPause(null);
        task.setStatus(nextStatus);
        taskRepository.save(task);

        // broadcast update
        TaskMessage msg = new TaskMessage("UPDATED", TaskResponse.fromTask(task));
        messagingTemplate.convertAndSend("/topic/tasks/project/" + task.getProject().getId(), msg);
        for (User collab : task.getCollaborators()) {
            messagingTemplate.convertAndSend("/topic/tasks/user/" + collab.getId(), msg);
        }

        return TaskResponse.fromTask(task);
    }

    private void validateCollaboratorTransition(TaskStatus nextStatus) {
        if (nextStatus != TaskStatus.IN_PROGRESS
                && nextStatus != TaskStatus.ON_HOLD
                && nextStatus != TaskStatus.IN_REVIEW) {
            throw new BadRequestException("Assignees can only move tasks to IN_PROGRESS, ON_HOLD or IN_REVIEW");
        }
    }

    private void applyHoldReasonRules(Task task, TaskStatus nextStatus, String holdReason) {
        String trimmedReason = holdReason == null ? null : holdReason.trim();

        if (nextStatus == TaskStatus.ON_HOLD) {
            if (trimmedReason == null || trimmedReason.isEmpty()) {
                throw new BadRequestException("holdReason is required when setting status to ON_HOLD");
            }
            task.setHoldReason(trimmedReason);
            return;
        }

        if (task.getStatus() == TaskStatus.ON_HOLD && nextStatus == TaskStatus.IN_PROGRESS) {
            task.setHoldReason(null);
            return;
        }

        if (nextStatus != TaskStatus.ON_HOLD) {
            task.setHoldReason(null);
        }
    }

    private boolean isAssignedToTask(Task task, User user) {
        if (task.getCollaborators() == null || user == null) {
            return false;
        }

        Long userId = user.getId();
        String email = user.getEmail();

        return task.getCollaborators().stream().anyMatch(collaborator ->
                collaborator != null && (
                        (userId != null && userId.equals(collaborator.getId()))
                                || (email != null && email.equalsIgnoreCase(collaborator.getEmail()))
                )
        );
    }

    private boolean hasCollaboratorUpdate(TaskRequest request) {
        return (request.getCollaboratorEmail() != null && !request.getCollaboratorEmail().isBlank())
                || (request.getCollaboratorEmails() != null && !request.getCollaboratorEmails().isEmpty());
    }

    private Set<User> resolveCollaborators(TaskRequest request) {
        Set<String> emails = new HashSet<>();

        if (request.getCollaboratorEmail() != null && !request.getCollaboratorEmail().isBlank()) {
            emails.add(request.getCollaboratorEmail().trim());
        }

        if (request.getCollaboratorEmails() != null) {
            request.getCollaboratorEmails().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(email -> !email.isBlank())
                    .forEach(emails::add);
        }

        if (emails.isEmpty()) {
            throw new ResourceNotFoundException("Assignee", "No assignee email provided");
        }

        return emails.stream()
                .map(email -> userRepository.findByEmail(email)
                        .orElseThrow(() -> new ResourceNotFoundException("User", email)))
                .peek(this::assertAssignableTaskUser)
                .collect(Collectors.toSet());
    }

    private void assertAssignableTaskUser(User user) {
        UserRole role = user.getRole();
        if (role != UserRole.COLLABORATOR && role != UserRole.PROJECT_MANAGER) {
            throw new BadRequestException(
                    "Tasks can only be assigned to users with role COLLABORATOR or PROJECT_MANAGER: " + user.getEmail());
        }
    }

    private Set<Skill> resolveTaskSkillsFromRequest(Project project, List<Long> skillIds) {
        if (skillIds == null || skillIds.isEmpty()) {
            return new HashSet<>();
        }
        Set<Long> allowed = project.getRequiredSkills() == null || project.getRequiredSkills().isEmpty()
                ? Set.of()
                : project.getRequiredSkills().stream()
                .map(Skill::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (allowed.isEmpty()) {
            throw new BadRequestException(
                    "This project has no required skills configured; remove task skills or add required skills on the project first.");
        }
        List<Long> unique = skillIds.stream().filter(Objects::nonNull).distinct().toList();
        for (Long sid : unique) {
            if (!allowed.contains(sid)) {
                throw new BadRequestException("Each task skill must be among this project's required skills.");
            }
        }
        List<Skill> found = new ArrayList<>(skillRepository.findAllById(unique));
        if (found.size() != unique.size()) {
            throw new BadRequestException("One or more skill ids are invalid");
        }
        return new HashSet<>(found);
    }
}
