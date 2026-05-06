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
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public TaskReportResponse createReport(Long taskId, TaskReportRequest request, User reporter) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task", taskId));

        if (!isAssignedCollaborator(task, reporter)) {
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
        User manager = task.getProject().getManager();

        TaskReport report = new TaskReport();
        report.setTask(task);
        report.setReporter(reporter);
        report.setReason(reason);
        report.setDetails(details);

        TaskReport saved = taskReportRepository.save(report);
        Notification notification = notificationService.createTaskReportNotification(manager, saved);
        messagingTemplate.convertAndSend("/topic/notifications/user/" + manager.getId(), notification);

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
        TaskReport report = taskReportRepository.findById(reportId)
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

        Notification notification = notificationService.createTaskReportResolvedNotification(report.getReporter(), report);
        messagingTemplate.convertAndSend("/topic/notifications/user/" + report.getReporter().getId(), notification);
    }

    private boolean isAssignedCollaborator(Task task, User user) {
        if (task.getCollaborators() == null || user == null) {
            return false;
        }
        return task.getCollaborators().stream().anyMatch(collaborator ->
                collaborator != null && collaborator.getId() != null && collaborator.getId().equals(user.getId())
        );
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
