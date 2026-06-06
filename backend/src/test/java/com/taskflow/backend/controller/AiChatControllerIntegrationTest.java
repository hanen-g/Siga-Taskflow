package com.taskflow.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import com.taskflow.backend.service.OllamaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AiChatControllerIntegrationTest {

    private static final String ADMIN_EMAIL = "admin-ai@test.taskflow";
    private static final String ADMIN_PASSWORD = "AdminPass123!";
    private static final String COLLABORATOR_EMAIL = "collab-ai@test.taskflow";
    private static final String COLLABORATOR_PASSWORD = "CollabPass123!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private OllamaService ollamaService;

    private User adminUser;
    private User collaboratorUser;
    private String adminToken;
    private String collaboratorToken;

    @BeforeEach
    void seedUsers() {
        userRepository.deleteAll();

        adminUser = new User();
        adminUser.setEmail(ADMIN_EMAIL);
        adminUser.setPassword(passwordEncoder.encode(ADMIN_PASSWORD));
        adminUser.setFirstName("Admin");
        adminUser.setLastName("AI");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setActive(true);
        adminUser = userRepository.save(adminUser);

        collaboratorUser = new User();
        collaboratorUser.setEmail(COLLABORATOR_EMAIL);
        collaboratorUser.setPassword(passwordEncoder.encode(COLLABORATOR_PASSWORD));
        collaboratorUser.setFirstName("Collab");
        collaboratorUser.setLastName("AI");
        collaboratorUser.setRole(UserRole.COLLABORATOR);
        collaboratorUser.setActive(true);
        collaboratorUser = userRepository.save(collaboratorUser);

        adminToken = jwtService.generateToken(adminUser.getEmail(), UserRole.ADMIN.name());
        collaboratorToken = jwtService.generateToken(collaboratorUser.getEmail(), UserRole.COLLABORATOR.name());
    }

    /**
     * Scenario: an administrator sends a TaskFlow question and receives a parsed assistant reply.
     */
    @Test
    void chat_asAdmin_returnsOkWithAssistantMessage() throws Exception {
        // ARRANGE — Ollama returns message.content as text; AiAssistantService parses it via asText()
        JsonNode ollamaPayload = objectMapper.getNodeFactory().textNode("""
                {"message":"Voici les données TaskFlow.","actionType":"ANSWER","filters":{},"dataSnapshot":"test"}
                """);
        when(ollamaService.rawChat(any())).thenReturn(ollamaPayload);

        String body = """
                {
                  "message": "Combien de projets actifs y a-t-il?"
                }
                """;

        // ACT & ASSERT
        mockMvc.perform(post("/api/ai/chat")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assistantMessage").isNotEmpty())
                .andExpect(jsonPath("$.assistantMessage").value("Voici les données TaskFlow."));
    }

    /**
     * Scenario: POST /api/ai/chat without a JWT is rejected by Spring Security.
     */
    @Test
    void chat_withoutToken_returns403() throws Exception {
        // ARRANGE
        String body = """
                {
                  "message": "Hello"
                }
                """;

        // ACT & ASSERT
        mockMvc.perform(post("/api/ai/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    /**
     * Scenario: non-admin roles cannot access the AI chat endpoint.
     */
    @Test
    void chat_asCollaborator_returns403() throws Exception {
        // ARRANGE
        String body = """
                {
                  "message": "Hello"
                }
                """;

        // ACT & ASSERT
        mockMvc.perform(post("/api/ai/chat")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + collaboratorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    /**
     * Scenario: off-topic questions are refused with a TaskFlow-only message (no Ollama call).
     */
    @Test
    void chat_withOffTopicMessage_returnsRefusalMessage() throws Exception {
        // ARRANGE — stub present but off-topic path does not call Ollama
        JsonNode ollamaPayload = objectMapper.getNodeFactory().textNode("""
                {"message":"ignored","actionType":"ANSWER","filters":{},"dataSnapshot":"test"}
                """);
        when(ollamaService.rawChat(any())).thenReturn(ollamaPayload);

        String body = """
                {
                  "message": "What is the weather today?"
                }
                """;

        // ACT & ASSERT
        mockMvc.perform(post("/api/ai/chat")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assistantMessage", containsString("TaskFlow")));
    }
}
