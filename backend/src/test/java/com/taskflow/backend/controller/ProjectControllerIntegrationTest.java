package com.taskflow.backend.controller;

import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.ProjectRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProjectControllerIntegrationTest {

    private static final String ADMIN_EMAIL = "admin@test.taskflow";
    private static final String ADMIN_PASSWORD = "AdminPass123!";
    private static final String PM_EMAIL = "pm@test.taskflow";
    private static final String PM_PASSWORD = "PmPass123!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User adminUser;
    private User projectManagerUser;
    private String adminToken;
    private String projectManagerToken;

    @BeforeEach
    void seedUsers() {
        userRepository.deleteAll();
        projectRepository.deleteAll();

        adminUser = new User();
        adminUser.setEmail(ADMIN_EMAIL);
        adminUser.setPassword(passwordEncoder.encode(ADMIN_PASSWORD));
        adminUser.setFirstName("Admin");
        adminUser.setLastName("Integration");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setActive(true);
        adminUser = userRepository.save(adminUser);

        projectManagerUser = new User();
        projectManagerUser.setEmail(PM_EMAIL);
        projectManagerUser.setPassword(passwordEncoder.encode(PM_PASSWORD));
        projectManagerUser.setFirstName("PM");
        projectManagerUser.setLastName("Integration");
        projectManagerUser.setRole(UserRole.PROJECT_MANAGER);
        projectManagerUser.setActive(true);
        projectManagerUser = userRepository.save(projectManagerUser);

        adminToken = jwtService.generateToken(adminUser.getEmail(), UserRole.ADMIN.name());
        projectManagerToken = jwtService.generateToken(projectManagerUser.getEmail(), UserRole.PROJECT_MANAGER.name());
    }

    /**
     * Scenario: an administrator creates a project with a valid payload and receives ProjectResponse JSON.
     */
    @Test
    void createProject_asAdmin_returnsOkWithProjectResponse() throws Exception {
        // ARRANGE
        String projectName = "Integration Test Project";
        String body = createProjectJson(projectName, projectManagerUser.getId());

        // ACT & ASSERT
        mockMvc.perform(post("/api/projects")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(projectName))
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.status").exists());
    }

    /**
     * Scenario: creating a project without a name returns 400.
     */
    @Test
    void createProject_missingName_returnsBadRequest() throws Exception {
        LocalDate startDate = LocalDate.now();
        LocalDate deadline = startDate.plusDays(30);
        String body = """
                {
                  "name": "",
                  "description": "No name",
                  "startDate": "%s",
                  "deadline": "%s",
                  "manager": { "id": %d }
                }
                """.formatted(startDate, deadline, projectManagerUser.getId());

        mockMvc.perform(post("/api/projects")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    /**
     * Scenario: POST /api/projects without a JWT is rejected by Spring Security.
     */
    @Test
    void createProject_withoutToken_returns403() throws Exception {
        // ARRANGE
        String body = createProjectJson("Unauthorized Create Attempt", projectManagerUser.getId());

        // ACT & ASSERT
        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    /**
     * Scenario: a project manager cannot create projects (ADMIN-only @PreAuthorize).
     */
    @Test
    void createProject_asProjectManager_returns403() throws Exception {
        // ARRANGE
        String body = createProjectJson("PM Create Attempt", projectManagerUser.getId());

        // ACT & ASSERT
        mockMvc.perform(post("/api/projects")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + projectManagerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    /**
     * Scenario: an administrator lists all non-archived projects via GET /api/projects.
     */
    @Test
    void getAllProjects_asAdmin_returnsOkWithList() throws Exception {
        // ARRANGE — create one project so the list is non-empty (optional sanity check)
        mockMvc.perform(post("/api/projects")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createProjectJson("Listed Project", projectManagerUser.getId())))
                .andExpect(status().isOk());

        // ACT & ASSERT
        mockMvc.perform(get("/api/projects")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    private static String createProjectJson(String name, Long managerId) {
        LocalDate startDate = LocalDate.now();
        LocalDate deadline = startDate.plusDays(30);
        return """
                {
                  "name": "%s",
                  "description": "Integration test project description",
                  "startDate": "%s",
                  "deadline": "%s",
                  "manager": { "id": %d }
                }
                """.formatted(name, startDate, deadline, managerId);
    }
}
