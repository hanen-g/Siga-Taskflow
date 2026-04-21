package com.taskflow.backend.service;

import com.taskflow.backend.dto.task.TaskRequest;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.Priority;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.dto.websocket.TaskMessage;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;

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
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;


    public Task createTask(TaskRequest request, User manager) {

        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Project", request.getProjectId()));

        if (!project.getManager().getId().equals(manager.getId())) {
            throw new UnauthorizedException("You are not the manager of this project");
        }

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setProject(project);
        task.setCollaborators(resolveCollaborators(request));
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
            Notification notif = notificationService.createTaskAssignedNotification(collab, saved);
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

        Task saved = taskRepository.save(task);

        // Broadcast the update via WebSocket
        TaskMessage msg = new TaskMessage("UPDATED", TaskResponse.fromTask(saved));
        messagingTemplate.convertAndSend("/topic/tasks/project/" + saved.getProject().getId(), msg);

        for (User collab : saved.getCollaborators()) {
            if (!existingCollaboratorIds.contains(collab.getId())) {
                Notification notif = notificationService.createTaskAssignedNotification(collab, saved);
                messagingTemplate.convertAndSend("/topic/notifications/user/" + collab.getId(), notif);
            }
            messagingTemplate.convertAndSend("/topic/tasks/user/" + collab.getId(), msg);
        }

        return TaskResponse.fromTask(saved);
    }

    public List<TaskResponse> getTasksByProject(Long projectId, User user) {
        projectService.assertUserCanViewProject(projectId, user);
        return taskRepository.findByProjectId(projectId)
                .stream()
                .map(TaskResponse::fromTask)
                .toList();
    }

    public void deleteTask(Long taskId) {
        // retrieve before deletion to send message
        taskRepository.findById(taskId).ifPresent(task -> {
            TaskMessage msg = new TaskMessage("DELETED", TaskResponse.fromTask(task));
            messagingTemplate.convertAndSend("/topic/tasks/project/" + task.getProject().getId(), msg);
            for (User collab : task.getCollaborators()) {
                messagingTemplate.convertAndSend("/topic/tasks/user/" + collab.getId(), msg);
            }
        });
        taskRepository.deleteById(taskId);
    }

    public List<TaskResponse> getCollaboratorTasks(User user) {
        return taskRepository.findByCollaboratorsContaining(user)
                .stream()
                .map(TaskResponse::fromTask)
                .toList();
    }

    public List<TaskResponse> getManagerTasks(User manager) {
        return taskRepository.findByProjectManager(manager)
                .stream()
                .map(TaskResponse::fromTask)
                .toList();
    }

    public List<TaskResponse> getAllTasks() {
        return taskRepository.findAll()
                .stream()
                .map(TaskResponse::fromTask)
                .toList();
    }

    public TaskResponse updateStatus(Long taskId, String status, User user) {

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", taskId));

        if (!isAssignedCollaborator(task, user)) {
            throw new UnauthorizedException("You are not assigned to this task");
        }

        task.setStatus(TaskStatus.valueOf(status.toUpperCase(Locale.ROOT)));
        taskRepository.save(task);

        // broadcast update
        TaskMessage msg = new TaskMessage("UPDATED", TaskResponse.fromTask(task));
        messagingTemplate.convertAndSend("/topic/tasks/project/" + task.getProject().getId(), msg);
        for (User collab : task.getCollaborators()) {
            messagingTemplate.convertAndSend("/topic/tasks/user/" + collab.getId(), msg);
        }

        return TaskResponse.fromTask(task);
    }

    private boolean isAssignedCollaborator(Task task, User user) {
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
            throw new ResourceNotFoundException("Collaborator", "No collaborator email provided");
        }

        return emails.stream()
                .map(email -> userRepository.findByEmail(email)
                        .orElseThrow(() -> new ResourceNotFoundException("Collaborator", email)))
                .collect(Collectors.toSet());
    }
}
