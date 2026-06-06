package com.taskflow.backend.service;

import com.taskflow.backend.dto.reporting.AdminDashboardResponse;
import com.taskflow.backend.dto.reporting.CollaboratorDashboardResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.CommentRepository;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardReportingServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private CommentRepository commentRepository;

    @InjectMocks
    private DashboardReportingService dashboardReportingService;

    private User adminUser;
    private User projectManagerUser;
    private User collaboratorUser;
    private Project fakeProject;
    private Task fakeTask;

    @BeforeEach
    void setUp() {
        adminUser = new User();
        adminUser.setId(1L);
        adminUser.setEmail("admin@taskflow.test");
        adminUser.setFirstName("Admin");
        adminUser.setLastName("User");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setActive(true);

        projectManagerUser = new User();
        projectManagerUser.setId(2L);
        projectManagerUser.setEmail("pm@taskflow.test");
        projectManagerUser.setFirstName("Project");
        projectManagerUser.setLastName("Manager");
        projectManagerUser.setRole(UserRole.PROJECT_MANAGER);
        projectManagerUser.setActive(true);

        collaboratorUser = new User();
        collaboratorUser.setId(3L);
        collaboratorUser.setEmail("collab@taskflow.test");
        collaboratorUser.setFirstName("Collab");
        collaboratorUser.setLastName("User");
        collaboratorUser.setRole(UserRole.COLLABORATOR);
        collaboratorUser.setActive(true);

        fakeProject = new Project();
        fakeProject.setId(10L);
        fakeProject.setName("Reporting Project");
        fakeProject.setManager(projectManagerUser);

        fakeTask = new Task();
        fakeTask.setId(100L);
        fakeTask.setTitle("Done task");
        fakeTask.setStatus(TaskStatus.DONE);
        fakeTask.setProject(fakeProject);
        fakeTask.setCollaborators(Set.of(collaboratorUser));

        fakeProject.setTasks(List.of(fakeTask));
    }

    // Admin dashboard returns KPIs when the caller is an admin and data exists.
    @Test
    void testAdminDashboard_success_returnsValidResponse() {
        // ARRANGE
        when(userRepository.findAll()).thenReturn(List.of(adminUser, projectManagerUser, collaboratorUser));
        when(projectRepository.findAllDistinctForReporting()).thenReturn(List.of(fakeProject));
        when(taskRepository.findAllFetchingProject()).thenReturn(List.of(fakeTask));
        when(userRepository.countByIsActive(false)).thenReturn(0L);
        when(commentRepository.findMaxCreatedAtByTaskIdIn(anyCollection())).thenReturn(Collections.emptyList());
        when(userRepository.findById(collaboratorUser.getId())).thenReturn(Optional.of(collaboratorUser));
        when(commentRepository.countTasksWithPmRevisionSignalForCollaboratorInProjects(
                eq(collaboratorUser.getId()), any())).thenReturn(0L);

        // ACT
        AdminDashboardResponse response = dashboardReportingService.adminDashboard(adminUser);

        // ASSERT
        assertNotNull(response);
        assertEquals(3, response.totalUsers());
        assertEquals(1, response.totalProjects());
        assertEquals(1, response.totalTasks());
    }

    // Admin dashboard rejects non-admin users.
    @Test
    void testAdminDashboard_nonAdmin_throwsUnauthorizedException() {
        // ARRANGE — no repository stubs; authorization fails first

        // ACT & ASSERT
        assertThrows(UnauthorizedException.class,
                () -> dashboardReportingService.adminDashboard(collaboratorUser));
    }

    // Collaborator dashboard returns task counts for an assigned collaborator.
    @Test
    void testCollaboratorDashboard_success_returnsValidResponse() {
        // ARRANGE
        when(taskRepository.findByCollaboratorsContaining(collaboratorUser)).thenReturn(List.of(fakeTask));
        when(commentRepository.countTasksWithPmRevisionSignalForCollaborator(collaboratorUser.getId()))
                .thenReturn(0L);
        when(commentRepository.findMinCreatedAtByTaskIdIn(any())).thenReturn(Collections.emptyList());
        when(commentRepository.findMaxCreatedAtByTaskIdIn(any())).thenReturn(Collections.emptyList());

        // ACT
        CollaboratorDashboardResponse response =
                dashboardReportingService.collaboratorDashboard(collaboratorUser);

        // ASSERT
        assertNotNull(response);
        assertEquals(1, response.totalAssigned());
        assertEquals(1, response.completed());
    }

    // Collaborator dashboard rejects users who are not collaborators.
    @Test
    void testCollaboratorDashboard_nonCollaborator_throwsUnauthorizedException() {
        // ARRANGE — no repository stubs; authorization fails first

        // ACT & ASSERT
        assertThrows(UnauthorizedException.class,
                () -> dashboardReportingService.collaboratorDashboard(adminUser));
    }

    // Admin dashboard reports zero KPIs when the platform has no data.
    @Test
    void testAdminDashboard_emptyPlatform_returnsZeroKpis() {
        // ARRANGE
        when(userRepository.findAll()).thenReturn(Collections.emptyList());
        when(projectRepository.findAllDistinctForReporting()).thenReturn(Collections.emptyList());
        when(taskRepository.findAllFetchingProject()).thenReturn(Collections.emptyList());
        when(userRepository.countByIsActive(false)).thenReturn(0L);

        // ACT
        AdminDashboardResponse response = dashboardReportingService.adminDashboard(adminUser);

        // ASSERT
        assertNotNull(response);
        assertEquals(0, response.totalUsers());
        assertEquals(0, response.totalProjects());
        assertEquals(0, response.totalTasks());
    }
}
