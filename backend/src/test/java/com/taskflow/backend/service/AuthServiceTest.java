package com.taskflow.backend.service;

import com.taskflow.backend.dto.auth.AuthResponse;
import com.taskflow.backend.dto.auth.LoginRequest;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private RandomPasswordService randomPasswordService;

    @Mock
    private SkillRepository skillRepository;

    @Mock
    private CompanyService companyService;

    @Mock
    private AccountEmailService accountEmailService;

    @InjectMocks
    private AuthService authService;

    /**
     * Scenario: an active user submits valid credentials and receives a JWT plus profile fields.
     */
    @Test
    void testLogin_success() {
        // ARRANGE
        String email = "user@taskflow.test";
        String rawPassword = "SecretPass123!";
        User user = new User();
        user.setId(1L);
        user.setEmail(email);
        user.setPassword("encoded-password");
        user.setRole(UserRole.ADMIN);
        user.setActive(true);

        LoginRequest request = new LoginRequest(email, rawPassword);

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(rawPassword, user.getPassword())).thenReturn(true);
        when(jwtService.generateToken(email, UserRole.ADMIN.name())).thenReturn("fake-jwt-token");

        // ACT
        AuthResponse response = authService.login(request);

        // ASSERT
        assertNotNull(response);
        assertEquals("fake-jwt-token", response.getToken());
        assertEquals(email, response.getEmail());
        assertEquals(UserRole.ADMIN.name(), response.getRole());
        verify(jwtService).generateToken(email, UserRole.ADMIN.name());
    }

    /**
     * Scenario: login is attempted with an email that does not exist in the database.
     */
    @Test
    void testLogin_userNotFound_throwsException() {
        // ARRANGE
        String email = "unknown@taskflow.test";
        LoginRequest request = new LoginRequest(email, "any-password");
        when(userRepository.findByEmail(email)).thenReturn(Optional.empty());

        // ACT + ASSERT
        assertThrows(RuntimeException.class, () -> authService.login(request));
    }

    /**
     * Scenario: a deactivated account tries to log in and is rejected before password check.
     */
    @Test
    void testLogin_inactiveAccount_throwsException() {
        // ARRANGE
        String email = "inactive@taskflow.test";
        User user = new User();
        user.setEmail(email);
        user.setPassword("encoded-password");
        user.setRole(UserRole.COLLABORATOR);
        user.setActive(false);

        LoginRequest request = new LoginRequest(email, "any-password");
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));

        // ACT + ASSERT
        assertThrows(IllegalStateException.class, () -> authService.login(request));
    }

    /**
     * Scenario: the email exists but the password does not match the stored hash.
     */
    @Test
    void testLogin_wrongPassword_throwsException() {
        // ARRANGE
        String email = "user@taskflow.test";
        String rawPassword = "wrong-password";
        User user = new User();
        user.setEmail(email);
        user.setPassword("encoded-password");
        user.setRole(UserRole.PROJECT_MANAGER);
        user.setActive(true);

        LoginRequest request = new LoginRequest(email, rawPassword);
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(rawPassword, user.getPassword())).thenReturn(false);

        // ACT + ASSERT
        assertThrows(RuntimeException.class, () -> authService.login(request));
    }

    /**
     * Scenario: forgot-password is requested for an unknown email — same generic message (no enumeration).
     */
    @Test
    void testForgotPassword_emailNotFound_returnsGenericMessage() {
        // ARRANGE
        String email = "unknown@taskflow.test";
        when(userRepository.findByEmail(email)).thenReturn(Optional.empty());

        // ACT
        String message = authService.forgotPassword(email);

        // ASSERT
        assertEquals(AuthService.FORGOT_PASSWORD_GENERIC_MESSAGE, message);
    }

    /**
     * Scenario: forgot-password is requested for a deactivated account — same generic message (no enumeration).
     */
    @Test
    void testForgotPassword_inactiveUser_returnsGenericMessage() {
        // ARRANGE
        String email = "inactive@taskflow.test";
        User user = new User();
        user.setEmail(email);
        user.setActive(false);

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));

        // ACT
        String message = authService.forgotPassword(email);

        // ASSERT
        assertEquals(AuthService.FORGOT_PASSWORD_GENERIC_MESSAGE, message);
    }
}
