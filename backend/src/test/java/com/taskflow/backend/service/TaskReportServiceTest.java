package com.taskflow.backend.service;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskReport;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.TaskReportRepository;
import com.taskflow.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskReportServiceTest {

    @Mock
    private TaskReportRepository taskReportRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private TaskReportService taskReportService;

    private User projectManager;
    private User reporter;
    private TaskReport openReport;

    @BeforeEach
    void setUp() {
        projectManager = new User();
        projectManager.setId(10L);
        projectManager.setEmail("pm@taskflow.test");
        projectManager.setFirstName("Alice");
        projectManager.setLastName("Manager");
        projectManager.setRole(UserRole.PROJECT_MANAGER);

        reporter = new User();
        reporter.setId(20L);
        reporter.setEmail("collab@taskflow.test");
        reporter.setRole(UserRole.COLLABORATOR);

        Project project = new Project();
        project.setId(1L);
        project.setName("Website redesign");
        project.setManager(projectManager);

        Task task = new Task();
        task.setId(100L);
        task.setTitle("Fix login bug");
        task.setProject(project);

        openReport = new TaskReport();
        openReport.setId(500L);
        openReport.setTask(task);
        openReport.setReporter(reporter);
        openReport.setReason("Blocked");
        openReport.setDetails("Cannot reproduce on staging");
        openReport.setResolved(false);
    }

    /**
     * Scenario: the project manager marks an open task report as resolved.
     * Verifies business rules and side effects without touching a real database.
     */
    @Test
    void resolveReport_marksReportResolvedAndNotifiesReporter() {
        // Arrange
        when(taskReportRepository.findDetailedById(500L)).thenReturn(Optional.of(openReport));
        when(taskReportRepository.save(any(TaskReport.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        taskReportService.resolveReport(500L, projectManager);

        // Assert — report state updated in memory before save
        ArgumentCaptor<TaskReport> savedReport = ArgumentCaptor.forClass(TaskReport.class);
        verify(taskReportRepository).save(savedReport.capture());
        TaskReport persisted = savedReport.getValue();

        assertTrue(persisted.isResolved(), "resolved flag must be set to true");
        assertNotNull(persisted.getResolvedAt(), "resolvedAt timestamp must be recorded");

        verify(messagingTemplate).convertAndSend(
                eq("/topic/notifications/user/20"),
                any(Object.class)
        );
    }

    /**
     * Scenario: a user who is not the project's manager tries to resolve a report.
     * Verifies authorization is enforced at the service layer.
     */
    @Test
    void resolveReport_throwsWhenCallerIsNotProjectManager() {
        // Arrange
        User otherManager = new User();
        otherManager.setId(99L);
        otherManager.setEmail("other@taskflow.test");
        otherManager.setRole(UserRole.PROJECT_MANAGER);

        when(taskReportRepository.findDetailedById(500L)).thenReturn(Optional.of(openReport));

        // Act + Assert
        assertThrows(UnauthorizedException.class, () ->
                taskReportService.resolveReport(500L, otherManager));

        verify(taskReportRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    /**
     * Scenario: resolve is called on a report that is already resolved.
     * Verifies the operation is idempotent (no duplicate save or notification).
     */
    @Test
    void resolveReport_isNoOpWhenAlreadyResolved() {
        // Arrange
        openReport.setResolved(true);
        when(taskReportRepository.findDetailedById(500L)).thenReturn(Optional.of(openReport));

        // Act
        taskReportService.resolveReport(500L, projectManager);

        // Assert — already-resolved reports must not trigger another save or WebSocket push
        verify(taskReportRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
        assertTrue(openReport.isResolved());
    }
}
