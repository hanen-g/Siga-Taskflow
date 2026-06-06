package com.taskflow.backend.service;

import com.taskflow.backend.dto.task.TaskRequest;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.dto.task.TaskStatusUpdateRequest;
import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectService projectService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private TaskService taskService;

    private User projectManager;
    private User collaborator;
    private Project project;
    private TaskRequest request;

    @BeforeEach
    void setUp() {
        projectManager = new User();
        projectManager.setId(10L);
        projectManager.setEmail("pm@taskflow.test");
        projectManager.setFirstName("Alice");
        projectManager.setLastName("Manager");
        projectManager.setRole(UserRole.PROJECT_MANAGER);

        collaborator = new User();
        collaborator.setId(20L);
        collaborator.setEmail("collab@taskflow.test");
        collaborator.setFirstName("Bob");
        collaborator.setLastName("Collaborator");
        collaborator.setRole(UserRole.COLLABORATOR);

        project = new Project();
        project.setId(1L);
        project.setName("Website redesign");
        project.setManager(projectManager);

        request = new TaskRequest();
        request.setTitle("Fix login bug");
        request.setProjectId(1L);
        request.setCollaboratorEmail("collab@taskflow.test");
    }

    /**
     * Scenario: the project manager creates a task with a valid assignee.
     * Verifies the new task is persisted with status TODO and the expected title.
     */
    @Test
    void testCreateTask_success_setsStatusTodo() {
        // ARRANGE
        when(projectRepository.findDetailedById(1L)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("collab@taskflow.test")).thenReturn(Optional.of(collaborator));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> {
            Task saved = invocation.getArgument(0);
            saved.setId(100L);
            return saved;
        });
        when(notificationService.createTaskAssignedNotification(any(), any(), any()))
                .thenReturn(new Notification());

        // ACT
        Task result = taskService.createTask(request, projectManager);

        // ASSERT
        assertNotNull(result);
        assertEquals(TaskStatus.TODO, result.getStatus());
        assertEquals(request.getTitle(), result.getTitle());
        verify(taskRepository).save(any(Task.class));
    }

    /**
     * Scenario: a user who is not the project's manager tries to create a task.
     * Verifies authorization is enforced at the service layer.
     */
    @Test
    void testCreateTask_notProjectManager_throwsUnauthorizedException() {
        // ARRANGE
        User otherManager = new User();
        otherManager.setId(99L);
        otherManager.setEmail("other@taskflow.test");
        otherManager.setRole(UserRole.PROJECT_MANAGER);

        when(projectRepository.findDetailedById(1L)).thenReturn(Optional.of(project));

        // ACT + ASSERT
        assertThrows(UnauthorizedException.class, () ->
                taskService.createTask(request, otherManager));
    }

    /**
     * Scenario: a task is created successfully.
     * Verifies a WebSocket message is broadcast on the project tasks topic.
     */
    @Test
    void testCreateTask_broadcastsWebSocketMessage() {
        // ARRANGE
        when(projectRepository.findDetailedById(1L)).thenReturn(Optional.of(project));
        when(userRepository.findByEmail("collab@taskflow.test")).thenReturn(Optional.of(collaborator));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> {
            Task saved = invocation.getArgument(0);
            saved.setId(100L);
            return saved;
        });
        when(notificationService.createTaskAssignedNotification(any(), any(), any()))
                .thenReturn(new Notification());

        // ACT
        taskService.createTask(request, projectManager);

        // ASSERT
        verify(messagingTemplate).convertAndSend(
                eq("/topic/tasks/project/" + project.getId()),
                any(Object.class)
        );
    }

    /**
     * Scenario: an assigned collaborator moves a TODO task to IN_PROGRESS.
     * Verifies the status transition is allowed and persisted.
     */
    @Test
    void testUpdateStatus_validTransition_setsStatusInProgress() {
        // ARRANGE
        Long taskId = 100L;
        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Fix login bug");
        task.setStatus(TaskStatus.TODO);
        task.setProject(project);
        Set<User> collaborators = new HashSet<>();
        collaborators.add(collaborator);
        task.setCollaborators(collaborators);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TaskStatusUpdateRequest statusRequest = new TaskStatusUpdateRequest();
        statusRequest.setStatus("IN_PROGRESS");

        // ACT
        TaskResponse response = taskService.updateStatus(taskId, statusRequest, collaborator);

        // ASSERT
        assertEquals("IN_PROGRESS", response.getStatus());
        verify(taskRepository).save(any(Task.class));
    }

    /**
     * Scenario: a user who is not assigned to the task tries to update its status.
     * Verifies authorization is enforced at the service layer.
     */
    @Test
    void testUpdateStatus_notAssigned_throwsUnauthorizedException() {
        // ARRANGE
        Long taskId = 100L;
        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Fix login bug");
        task.setStatus(TaskStatus.TODO);
        task.setProject(project);
        task.setCollaborators(new HashSet<>());

        User randomUser = new User();
        randomUser.setId(99L);
        randomUser.setEmail("random@taskflow.test");
        randomUser.setRole(UserRole.COLLABORATOR);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        TaskStatusUpdateRequest statusRequest = new TaskStatusUpdateRequest();
        statusRequest.setStatus("IN_PROGRESS");

        // ACT + ASSERT
        assertThrows(UnauthorizedException.class, () ->
                taskService.updateStatus(taskId, statusRequest, randomUser));
    }

    /**
     * Scenario: a collaborator tries to set status directly to DONE.
     * Verifies invalid transitions are rejected with BadRequestException.
     */
    @Test
    void testUpdateStatus_invalidStatus_throwsBadRequestException() {
        // ARRANGE
        Long taskId = 100L;
        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Fix login bug");
        task.setStatus(TaskStatus.TODO);
        task.setProject(project);
        Set<User> collaborators = new HashSet<>();
        collaborators.add(collaborator);
        task.setCollaborators(collaborators);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        TaskStatusUpdateRequest statusRequest = new TaskStatusUpdateRequest();
        statusRequest.setStatus("DONE");

        // ACT + ASSERT
        assertThrows(BadRequestException.class, () ->
                taskService.updateStatus(taskId, statusRequest, collaborator));
    }
}
