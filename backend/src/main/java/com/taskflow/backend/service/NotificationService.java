package com.taskflow.backend.service;

import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.entity.Message;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.ProjectProposal;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Persists notification FKs only. Message and {@link com.taskflow.backend.dto.websocket.Notification#getKind()}
 * are derived at read time from {@code proposal_id}, {@code task_id}, and {@code project_id}.
 * Task report events are not stored as notifications: they would share the same FK shape as task assignments.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    public static final String KIND_PROPOSAL_SUBMITTED = "PROPOSAL_SUBMITTED";
    public static final String KIND_TASK_ASSIGNED = "TASK_ASSIGNED";
    public static final String KIND_PROJECT_ASSIGNED = "PROJECT_ASSIGNED";
    public static final String KIND_PROJECT_MESSAGE = "PROJECT_MESSAGE";
    public static final String KIND_UNKNOWN = "UNKNOWN";

    private final NotificationRepository notificationRepository;

    @Transactional
    public Notification createTaskAssignedNotification(User recipient, User actor, Task task) {
        com.taskflow.backend.entity.Notification entity = new com.taskflow.backend.entity.Notification();
        entity.setRecipient(recipient);
        entity.setActor(actor);
        entity.setTask(task);
        entity.setProject(task.getProject());
        entity.setProposal(null);
        entity.setRead(false);
        com.taskflow.backend.entity.Notification saved = notificationRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public Notification createProjectAssignedNotification(User recipient, User actor, Project project) {
        com.taskflow.backend.entity.Notification entity = new com.taskflow.backend.entity.Notification();
        entity.setRecipient(recipient);
        entity.setActor(actor);
        entity.setTask(null);
        entity.setProject(project);
        entity.setProposal(null);
        entity.setRead(false);
        com.taskflow.backend.entity.Notification saved = notificationRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public Notification createProjectMessageNotification(User recipient, User actor, Project project, Message message) {
        com.taskflow.backend.entity.Notification entity = new com.taskflow.backend.entity.Notification();
        entity.setRecipient(recipient);
        entity.setActor(actor);
        entity.setTask(null);
        entity.setProject(project);
        entity.setProposal(null);
        entity.setMessage(message);
        entity.setRead(false);
        com.taskflow.backend.entity.Notification saved = notificationRepository.save(entity);
        return toDto(saved);
    }

    @Transactional
    public void markProjectChatNotificationsAsRead(User recipient, Long projectId) {
        List<com.taskflow.backend.entity.Notification> notifications =
                notificationRepository.findByRecipientIdAndProjectIdAndMessageIsNotNull(recipient.getId(), projectId);
        notifications.forEach(notification -> notification.setRead(true));
        notificationRepository.saveAll(notifications);
    }

    @Transactional
    public Notification createProjectProposalSubmittedNotification(User recipient, User actor, ProjectProposal proposal) {
        com.taskflow.backend.entity.Notification entity = new com.taskflow.backend.entity.Notification();
        entity.setRecipient(recipient);
        entity.setActor(actor);
        entity.setTask(null);
        entity.setProject(null);
        entity.setProposal(proposal);
        entity.setRead(false);
        com.taskflow.backend.entity.Notification saved = notificationRepository.save(entity);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<Notification> getNotificationsForUser(User user) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void markAllAsRead(User user) {
        List<com.taskflow.backend.entity.Notification> notifications =
                notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId());
        notifications.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(notifications);
    }

    @Transactional
    public void clearAll(User user) {
        notificationRepository.deleteByRecipientId(user.getId());
    }

    public Notification toDto(com.taskflow.backend.entity.Notification entity) {
        return new Notification(
                entity.getId(),
                buildMessage(entity),
                deriveKind(entity),
                entity.isRead(),
                entity.getCreatedAt(),
                entity.getProject() != null ? entity.getProject().getId() : null,
                entity.getTask() != null ? entity.getTask().getId() : null
        );
    }

    /**
     * Kind is inferred from FK presence: proposal first, then task, then project-only.
     */
    public static String deriveKind(com.taskflow.backend.entity.Notification entity) {
        if (entity.getMessage() != null) {
            return KIND_PROJECT_MESSAGE;
        }
        if (entity.getProposal() != null) {
            return KIND_PROPOSAL_SUBMITTED;
        }
        if (entity.getTask() != null) {
            return KIND_TASK_ASSIGNED;
        }
        if (entity.getProject() != null) {
            return KIND_PROJECT_ASSIGNED;
        }
        return KIND_UNKNOWN;
    }

    private String buildMessage(com.taskflow.backend.entity.Notification entity) {
        if (entity.getMessage() != null && entity.getProject() != null) {
            Project project = entity.getProject();
            String name = project.getName() != null && !project.getName().isBlank()
                    ? project.getName()
                    : "a project";
            UserRole actorRole = entity.getActor() != null ? entity.getActor().getRole() : null;
            if (actorRole == UserRole.CLIENT) {
                return "New message from a client on " + name;
            }
            return "New message from Admin on " + name;
        }

        String actorName = formatUserFullName(entity.getActor());
        if (entity.getProposal() != null) {
            ProjectProposal proposal = entity.getProposal();
            String title = proposal.getName() != null && !proposal.getName().isBlank()
                    ? proposal.getName()
                    : "a project proposal";
            return "New project proposal \"" + title + "\" submitted by \"" + actorName + "\".";
        }
        if (entity.getTask() != null) {
            Task task = entity.getTask();
            String taskTitle = taskTitleOrFallback(task);
            return "You have been assigned to \"" + taskTitle + "\" by \"" + actorName + "\"";
        }
        if (entity.getProject() != null) {
            Project project = entity.getProject();
            String name = project.getName() != null && !project.getName().isBlank()
                    ? project.getName()
                    : "a project";
            return "Project \"" + name + "\" has been assigned to you by \"" + actorName + "\"";
        }
        return "Notification";
    }

    private static String taskTitleOrFallback(Task task) {
        if (task != null && task.getTitle() != null && !task.getTitle().isBlank()) {
            return task.getTitle();
        }
        return "a task";
    }

    private String formatUserFullName(User user) {
        if (user == null) {
            return "Unknown";
        }
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        return fullName.isBlank() ? (user.getEmail() != null ? user.getEmail() : "Unknown") : fullName;
    }
}
