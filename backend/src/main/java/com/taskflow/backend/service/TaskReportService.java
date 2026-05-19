package com.taskflow.backend.service;

import com.taskflow.backend.dto.task.TaskReportRequest;
import com.taskflow.backend.dto.task.TaskReportResponse;
import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskReport;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.TaskReportRepository;
import com.taskflow.backend.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskReportService {

    private final TaskReportRepository taskReportRepository;
    private final TaskRepository taskRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public TaskReportResponse createReport(Long taskId, TaskReportRequest request, User reporter) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", taskId));

        User assignee = task.soleAssignedCollaborator()
                .orElseThrow(() -> new BadRequestException(
                        "Task must have exactly one assigned collaborator to submit a report."));
        if (!assignee.getId().equals(reporter.getId())) {
            throw new UnauthorizedException("You are not assigned to this task");
        }

        String reason = request == null ? null : trimToNull(request.getReason());
        String details = request == null ? null : trimToNull(request.getDetails());

        if (reason == null) {
            throw new BadRequestException("Report reason is required");
        }
        if (details == null) {
            throw new BadRequestException("Report details are required");
        }

        if (task.getProject() == null || task.getProject().getManager() == null) {
            throw new BadRequestException("Task project has no assigned manager");
        }

        TaskReport report = new TaskReport();
        report.setTask(task);
        report.setReporter(reporter);
        report.setReason(reason);
        report.setDetails(details);

        TaskReport saved = taskReportRepository.save(report);
        return TaskReportResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<TaskReportResponse> getOpenReportsForManager(User manager) {
        return taskReportRepository.findByTaskProjectManagerAndResolvedFalseOrderByCreatedAtDesc(manager)
                .stream()
                .map(TaskReportResponse::fromEntity)
                .toList();
    }

    @Transactional
    public void resolveReport(Long reportId, User manager) {
        TaskReport report = taskReportRepository.findDetailedById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Task report", reportId));

        User projectManager = report.getTask() != null
                && report.getTask().getProject() != null
                ? report.getTask().getProject().getManager()
                : null;
        if (projectManager == null || !projectManager.getId().equals(manager.getId())) {
            throw new UnauthorizedException("You are not the manager of this project");
        }

        if (report.isResolved()) {
            return;
        }

        report.setResolved(true);
        report.setResolvedAt(LocalDateTime.now());
        taskReportRepository.save(report);

        User reporter = report.getReporter();
        if (reporter != null && reporter.getId() != null) {
            Task task = report.getTask();
            String taskTitle = task != null && task.getTitle() != null && !task.getTitle().isBlank()
                    ? task.getTitle()
                    : "a task";
            String managerName = formatUserDisplayName(manager);
            String message = "Your problem report for \"" + taskTitle + "\" was marked resolved by \""
                    + managerName + "\".";
            Notification wsPayload = new Notification(
                    null,
                    message,
                    NotificationService.KIND_UNKNOWN,
                    false,
                    LocalDateTime.now(),
                    null,
                    null);
            messagingTemplate.convertAndSend("/topic/notifications/user/" + reporter.getId(), wsPayload);
        }
    }

    private static String formatUserDisplayName(User user) {
        if (user == null) {
            return "Unknown";
        }
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        return fullName.isBlank() ? (user.getEmail() != null ? user.getEmail() : "Unknown") : fullName;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
