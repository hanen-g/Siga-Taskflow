package com.taskflow.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthLoginIntegrationTest {

    private static final String TEST_EMAIL = "integration@test.taskflow";
    private static final String TEST_PASSWORD = "TestPass123!";

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

    @BeforeEach
    void seedTestUser() {
        userRepository.deleteAll();

        User user = new User();
        user.setEmail(TEST_EMAIL);
        user.setPassword(passwordEncoder.encode(TEST_PASSWORD));
        user.setFirstName("Integration");
        user.setLastName("Tester");
        user.setRole(UserRole.ADMIN);
        user.setActive(true);
        userRepository.save(user);
    }

    /**
     * Scenario: POST /api/auth/login with valid credentials.
     * Verifies the full HTTP pipeline (controller → AuthService → JwtService) returns
     * a signed JWT that JwtService accepts as valid.
     *
     * Note: AuthResponse exposes a single field named "token" (not accessToken/refreshToken).
     */
    @Test
    void login_returnsValidJwtToken() throws Exception {
        // Act — simulate a real HTTP login request
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "%s"
                                }
                                """.formatted(TEST_EMAIL, TEST_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.email").value(TEST_EMAIL))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andReturn();

        // Assert — extract token and verify JwtService accepts it
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        String token = body.get("token").asText();

        assertNotNull(token, "response must contain a non-null JWT string");
        assertFalse(token.isBlank(), "JWT string must not be empty");
        assertTrue(jwtService.isTokenValid(token),
                "JwtService must accept the token produced by the login endpoint");
        assertEquals(TEST_EMAIL, jwtService.extractEmail(token),
                "JWT subject must match the authenticated user's email");
    }

    /**
     * Scenario: POST /api/auth/login with a wrong password.
     * Verifies invalid credentials are rejected before any token is issued.
     */
    @Test
    void login_rejectsInvalidCredentials() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "%s",
                                  "password": "wrong-password"
                                }
                                """.formatted(TEST_EMAIL)))
                .andExpect(status().isUnauthorized());
    }
}
