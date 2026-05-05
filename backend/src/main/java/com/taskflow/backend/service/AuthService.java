package com.taskflow.backend.service;

import com.taskflow.backend.dto.auth.AdminCreateUserRequest;
import com.taskflow.backend.dto.auth.AuthResponse;
import com.taskflow.backend.dto.auth.LoginRequest;
import com.taskflow.backend.dto.auth.SignupRequest;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RandomPasswordService randomPasswordService;
    private final SkillRepository skillRepository;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RandomPasswordService randomPasswordService,
            SkillRepository skillRepository
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.randomPasswordService = randomPasswordService;
        this.skillRepository = skillRepository;
    }

    public record ProvisioningResult(User user, String temporaryPassword) {}

    /**
     * Creates a user (admin only via API) with a system-generated password. Does not return a session token.
     */
    public ProvisioningResult createUserByAdmin(AdminCreateUserRequest request) {
        if (request.getRole() == null) {
            throw new IllegalArgumentException("Role is required. Must be PROJECT_MANAGER, COLLABORATOR, CLIENT or ADMIN.");
        }
        String email = normalizeEmail(request.getEmail());
        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("Email is required.");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        String temporaryPassword = randomPasswordService.generateTemporaryPassword();

        User user = new User();
        user.setFirstName(request.getFirstName() == null ? null : request.getFirstName().trim());
        user.setLastName(request.getLastName() == null ? null : request.getLastName().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(temporaryPassword));
        user.setRole(request.getRoleAsEnum());
        user.setActive(true);
        user.setSkills(resolveSkillsForRole(user.getRole(), request.getSkillIds()));

        return new ProvisioningResult(userRepository.save(user), temporaryPassword);
    }

    private HashSet<Skill> resolveSkillsForRole(UserRole role, List<Long> skillIds) {
        if (role != UserRole.PROJECT_MANAGER && role != UserRole.COLLABORATOR) {
            return new HashSet<>();
        }
        if (skillIds == null || skillIds.isEmpty()) {
            return new HashSet<>();
        }
        List<Long> uniqueIds = skillIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        List<Skill> found = skillRepository.findAllById(uniqueIds);
        if (found.size() != uniqueIds.size()) {
            throw new BadRequestException("One or more selected skills are invalid.");
        }
        return new HashSet<>(found);
    }

    /**
     * Self-service registration. Cannot create ADMIN users; emails need not receive mail (any unique string works for local testing).
     */
    public AuthResponse signup(SignupRequest request) {
        UserRole role;
        try {
            role = request.getRoleAsEnum();
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(e.getMessage());
        }
        if (role == UserRole.ADMIN) {
            throw new BadRequestException("Self-registration cannot create administrator accounts.");
        }

        String email = normalizeEmail(request.getEmail());
        if (email == null || email.isEmpty()) {
            throw new BadRequestException("Email is required.");
        }

        String password = request.getPassword();
        if (password == null || password.length() < 6) {
            throw new BadRequestException("Password must be at least 6 characters.");
        }

        String firstName = request.getFirstName() == null ? "" : request.getFirstName().trim();
        String lastName = request.getLastName() == null ? "" : request.getLastName().trim();
        if (firstName.isEmpty() || lastName.isEmpty()) {
            throw new BadRequestException("First name and last name are required.");
        }

        if (userRepository.findByEmail(email).isPresent()) {
            throw new BadRequestException("Email already exists.");
        }

        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role);
        user.setActive(true);
        user.setSkills(new HashSet<>());

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved.getEmail(), saved.getRole().name());
        return new AuthResponse(token, saved);
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.isActive()) {
            throw new IllegalStateException("Account is deactivated. Please contact an administrator.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getRole().name()
        );
        return new AuthResponse(token, user);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
