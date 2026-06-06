package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.dto.websocket.ProjectMessage;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.ProjectStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private UploadedFileService uploadedFileService;

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ProjectService projectService;

    /**
     * Scenario: a new project with a future start date gets NOT_STARTED when status is unset.
     */
    @Test
    void testCreateProject_futureStartDate_setsStatusNotStarted() {
        // ARRANGE
        Project project = mockProjectWithMutableStatus();
        when(project.getName()).thenReturn("Future start project");
        when(project.getStartDate()).thenReturn(LocalDate.now().plusDays(10));
        when(project.getRequiredSkills()).thenReturn(null);
        when(projectRepository.save(project)).thenAnswer(invocation -> invocation.getArgument(0));

        // ACT
        ProjectResponse response = projectService.createProject(project);

        // ASSERT
        assertNotNull(response);
        ArgumentCaptor<Project> savedCaptor = ArgumentCaptor.forClass(Project.class);
        verify(projectRepository).save(savedCaptor.capture());
        assertEquals(ProjectStatus.NOT_STARTED, savedCaptor.getValue().getStatus());
    }

    /**
     * Scenario: a new project starting today gets IN_PROGRESS when status is unset.
     */
    @Test
    void testCreateProject_todayStartDate_setsStatusInProgress() {
        // ARRANGE
        Project project = mockProjectWithMutableStatus();
        when(project.getName()).thenReturn("Today start project");
        when(project.getStartDate()).thenReturn(LocalDate.now());
        when(project.getRequiredSkills()).thenReturn(null);
        when(projectRepository.save(project)).thenAnswer(invocation -> invocation.getArgument(0));

        // ACT
        ProjectResponse response = projectService.createProject(project);

        // ASSERT
        assertNotNull(response);
        ArgumentCaptor<Project> savedCaptor = ArgumentCaptor.forClass(Project.class);
        verify(projectRepository).save(savedCaptor.capture());
        assertEquals(ProjectStatus.IN_PROGRESS, savedCaptor.getValue().getStatus());
    }

    /**
     * Scenario: creating a project publishes one WebSocket message on /topic/projects.
     */
    @Test
    void testCreateProject_broadcastsWebSocketMessage() {
        // ARRANGE
        Project project = new Project();
        project.setName("New project");
        project.setStartDate(LocalDate.now());
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // ACT
        projectService.createProject(project);

        // ASSERT
        verify(messagingTemplate).convertAndSend(eq("/topic/projects"), any(ProjectMessage.class));
    }

    /**
     * Scenario: getAllProjects returns only non-archived projects from the repository.
     */
    @Test
    void testGetAllProjects_returnsNonArchivedProjects() {
        // ARRANGE
        Project inProgress = new Project();
        inProgress.setId(1L);
        inProgress.setName("Active");
        inProgress.setStatus(ProjectStatus.IN_PROGRESS);

        Project archived = new Project();
        archived.setId(2L);
        archived.setName("Archived");
        archived.setStatus(ProjectStatus.ARCHIVED);

        when(projectRepository.findByStatusNot(ProjectStatus.ARCHIVED)).thenReturn(List.of(inProgress));

        // ACT
        List<ProjectResponse> result = projectService.getAllProjects();

        // ASSERT
        assertEquals(1, result.size());
        assertTrue(result.stream().noneMatch(p -> p.getStatus() == ProjectStatus.ARCHIVED));
    }

    /**
     * Scenario: creating a project without a name is rejected.
     */
    @Test
    void testCreateProject_blankName_throwsBadRequestException() {
        Project project = new Project();
        project.setName("   ");

        assertThrows(BadRequestException.class, () -> projectService.createProject(project));
    }

    /**
     * Scenario: a collaborator cannot update a project; only admins may.
     */
    @Test
    void testUpdateProject_nonAdmin_throwsUnauthorizedException() {
        // ARRANGE
        User collaboratorUser = new User();
        collaboratorUser.setRole(UserRole.COLLABORATOR);

        Project existing = new Project();
        existing.setId(1L);
        existing.setName("Existing");

        Project details = new Project();
        details.setName("Updated name");

        when(projectRepository.findById(1L)).thenReturn(Optional.of(existing));

        // ACT & ASSERT
        assertThrows(
                UnauthorizedException.class,
                () -> projectService.updateProject(1L, details, collaboratorUser)
        );
    }

    /**
     * Mockito mock whose getStatus/setStatus behave like an unset status field
     * (Project entity normalizes null to IN_PROGRESS in getStatus/setStatus).
     */
    private static Project mockProjectWithMutableStatus() {
        Project project = mock(Project.class);
        when(project.getName()).thenReturn("Mock project");
        AtomicReference<ProjectStatus> status = new AtomicReference<>();
        when(project.getStatus()).thenAnswer(invocation -> status.get());
        doAnswer(invocation -> {
            status.set(invocation.getArgument(0));
            return null;
        }).when(project).setStatus(any(ProjectStatus.class));
        return project;
    }
}
