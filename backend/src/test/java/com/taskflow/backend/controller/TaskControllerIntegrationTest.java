package com.taskflow.backend.controller;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TaskControllerIntegrationTest {

    private static final String PM_EMAIL = "pm-tasks@test.taskflow";
    private static final String PM_PASSWORD = "PmPass123!";
    private static final String COLLABORATOR_EMAIL = "collab-tasks@test.taskflow";
    private static final String COLLABORATOR_PASSWORD = "CollabPass123!";
    private static final String OTHER_COLLABORATOR_EMAIL = "other-collab@test.taskflow";
    private static final String OTHER_COLLABORATOR_PASSWORD = "OtherCollab123!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User projectManagerUser;
    private User collaboratorUser;
    private Project project;
    private Task task;
    private String projectManagerToken;
    private String collaboratorToken;

    @BeforeEach
    void seedData() {
        taskRepository.deleteAll();
        projectRepository.deleteAll();
        userRepository.deleteAll();

        projectManagerUser = new User();
        projectManagerUser.setEmail(PM_EMAIL);
        projectManagerUser.setPassword(passwordEncoder.encode(PM_PASSWORD));
        projectManagerUser.setFirstName("PM");
        projectManagerUser.setLastName("Tasks");
        projectManagerUser.setRole(UserRole.PROJECT_MANAGER);
        projectManagerUser.setActive(true);
        projectManagerUser = userRepository.save(projectManagerUser);

        collaboratorUser = new User();
        collaboratorUser.setEmail(COLLABORATOR_EMAIL);
        collaboratorUser.setPassword(passwordEncoder.encode(COLLABORATOR_PASSWORD));
        collaboratorUser.setFirstName("Collab");
        collaboratorUser.setLastName("Tasks");
        collaboratorUser.setRole(UserRole.COLLABORATOR);
        collaboratorUser.setActive(true);
        collaboratorUser = userRepository.save(collaboratorUser);

        project = new Project();
        project.setName("Task Integration Project");
        project.setDescription("Project for TaskController integration tests");
        project.setStartDate(LocalDate.now());
        project.setDeadline(LocalDate.now().plusDays(30));
        project.setManager(projectManagerUser);
        project = projectRepository.save(project);

        task = new Task();
        task.setTitle("Integration Test Task");
        task.setDescription("Assigned to collaborator for status update tests");
        task.setStatus(TaskStatus.TODO);
        task.setProject(project);
        Set<User> collaborators = new HashSet<>();
        collaborators.add(collaboratorUser);
        task.setCollaborators(collaborators);
        task = taskRepository.save(task);

        projectManagerToken = jwtService.generateToken(projectManagerUser.getEmail(), UserRole.PROJECT_MANAGER.name());
        collaboratorToken = jwtService.generateToken(collaboratorUser.getEmail(), UserRole.COLLABORATOR.name());
    }

    /**
     * Scenario: the project manager lists tasks for a project they manage.
     */
    @Test
    void getTasksByProject_asProjectManager_returnsOkWithList() throws Exception {
        // ARRANGE — project, task, and PM token from @BeforeEach

        // ACT & ASSERT
        mockMvc.perform(get("/api/tasks/project/{projectId}", project.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + projectManagerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    /**
     * Scenario: GET /api/tasks/project/{id} without a JWT is rejected by Spring Security.
     */
    @Test
    void getTasksByProject_withoutToken_returns403() throws Exception {
        // ARRANGE — no Authorization header

        // ACT & ASSERT
        mockMvc.perform(get("/api/tasks/project/{projectId}", project.getId()))
                .andExpect(status().isForbidden());
    }

    /**
     * Scenario: an assigned collaborator updates task status to IN_PROGRESS.
     */
    @Test
    void updateTaskStatus_asCollaborator_returnsOk() throws Exception {
        // ARRANGE
        String body = statusUpdateJson("IN_PROGRESS");

        // ACT & ASSERT
        mockMvc.perform(patch("/api/tasks/{id}/status", task.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + collaboratorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    /**
     * Scenario: a collaborator who is not assigned to the task cannot change its status.
     */
    @Test
    void updateTaskStatus_notAssigned_returns403orUnauthorized() throws Exception {
        // ARRANGE
        User otherCollaborator = new User();
        otherCollaborator.setEmail(OTHER_COLLABORATOR_EMAIL);
        otherCollaborator.setPassword(passwordEncoder.encode(OTHER_COLLABORATOR_PASSWORD));
        otherCollaborator.setFirstName("Other");
        otherCollaborator.setLastName("Collab");
        otherCollaborator.setRole(UserRole.COLLABORATOR);
        otherCollaborator.setActive(true);
        otherCollaborator = userRepository.save(otherCollaborator);

        String otherCollaboratorToken = jwtService.generateToken(
                otherCollaborator.getEmail(),
                UserRole.COLLABORATOR.name()
        );
        String body = statusUpdateJson("IN_PROGRESS");

        // ACT & ASSERT
        mockMvc.perform(patch("/api/tasks/{id}/status", task.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherCollaboratorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(result -> {
                    int code = result.getResponse().getStatus();
                    assertTrue(
                            code == 403 || code == 401,
                            "Expected 403 Forbidden or 401 Unauthorized but was " + code
                    );
                });
    }

    private static String statusUpdateJson(String status) {
        return """
                {
                  "status": "%s"
                }
                """.formatted(status);
    }
}
