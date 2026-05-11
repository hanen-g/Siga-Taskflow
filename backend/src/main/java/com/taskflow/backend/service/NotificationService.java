package com.taskflow.backend.service;

import com.taskflow.backend.entity.Notification;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskReport;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional
    public com.taskflow.backend.dto.websocket.Notification createTaskAssignedNotification(User recipient, Task task) {
        Notification entity = new Notification();
        entity.setRecipient(recipient);
        entity.setMessage("New task assigned: " + task.getTitle());
        entity.setProjectName(task.getProject().getName());
        entity.setTaskTitle(task.getTitle());
        entity.setManagerName(formatManagerName(task.getProject().getManager()));
        entity.setRead(false);

        return com.taskflow.backend.dto.websocket.Notification.fromEntity(notificationRepository.save(entity));
    }

    @Transactional
    public com.taskflow.backend.dto.websocket.Notification createTaskReportNotification(User recipient, TaskReport report) {
        Notification entity = new Notification();
        entity.setRecipient(recipient);
        entity.setMessage("New task report from " + formatManagerName(report.getReporter()) + ": " + report.getReason());
        entity.setProjectName(report.getTask().getProject().getName());
        entity.setTaskTitle(report.getTask().getTitle());
        entity.setManagerName(formatManagerName(report.getTask().getProject().getManager()));
        entity.setRead(false);

        return com.taskflow.backend.dto.websocket.Notification.fromEntity(notificationRepository.save(entity));
    }

    @Transactional
    public com.taskflow.backend.dto.websocket.Notification createTaskReportResolvedNotification(User recipient, TaskReport report) {
        Notification entity = new Notification();
        entity.setRecipient(recipient);
        entity.setMessage("Your task report was reviewed by the project manager.");
        entity.setProjectName(report.getTask().getProject().getName());
        entity.setTaskTitle(report.getTask().getTitle());
        entity.setManagerName(formatManagerName(report.getTask().getProject().getManager()));
        entity.setRead(false);

        return com.taskflow.backend.dto.websocket.Notification.fromEntity(notificationRepository.save(entity));
    }

    @Transactional
    public com.taskflow.backend.dto.websocket.Notification createProjectProposalSubmittedNotification(
            User adminRecipient,
            String proposalName,
            User submitter) {
        Notification entity = new Notification();
        entity.setRecipient(adminRecipient);
        entity.setMessage(
                "New project proposal idea submitted: « "
                        + proposalName
                        + " » By "
                        + formatManagerName(submitter));
        entity.setRead(false);

        return com.taskflow.backend.dto.websocket.Notification.fromEntity(notificationRepository.save(entity));
    }

    @Transactional
    public com.taskflow.backend.dto.websocket.Notification createProjectProposalApprovedNotification(
            User proposer,
            String proposalName,
            String createdProjectName,
            User adminApprover) {
        Notification entity = new Notification();
        entity.setRecipient(proposer);
        entity.setMessage(
                "Your project idea « "
                        + proposalName
                        + " » was approved and created as « "
                        + createdProjectName
                        + " ».");
        entity.setProjectName(createdProjectName);
        entity.setTaskTitle("Project idea approved");
        entity.setManagerName(formatManagerName(adminApprover));
        entity.setRead(false);

        return com.taskflow.backend.dto.websocket.Notification.fromEntity(notificationRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<com.taskflow.backend.dto.websocket.Notification> getNotificationsForUser(User user) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(com.taskflow.backend.dto.websocket.Notification::fromEntity)
                .toList();
    }

    @Transactional
    public void markAllAsRead(User user) {
        List<Notification> notifications = notificationRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId());
        notifications.forEach(notification -> notification.setRead(true));
        notificationRepository.saveAll(notifications);
    }

    @Transactional
    public void clearAll(User user) {
        notificationRepository.deleteByRecipientId(user.getId());
    }

    private String formatManagerName(User manager) {
        if (manager == null) {
            return null;
        }

        String firstName = manager.getFirstName() == null ? "" : manager.getFirstName().trim();
        String lastName = manager.getLastName() == null ? "" : manager.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();

        return fullName.isBlank() ? manager.getEmail() : fullName;
    }
}
