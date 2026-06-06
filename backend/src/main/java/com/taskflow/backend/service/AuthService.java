package com.taskflow.backend.service;

import com.taskflow.backend.dto.auth.AdminCreateUserRequest;
import com.taskflow.backend.dto.auth.AuthResponse;
import com.taskflow.backend.dto.auth.LoginRequest;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import com.taskflow.backend.util.ClientLabelColors;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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
    private final CompanyService companyService;
    private final AccountEmailService accountEmailService;

    public static final String FORGOT_PASSWORD_GENERIC_MESSAGE =
            "If an account exists for this email, a new password has been sent.";

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RandomPasswordService randomPasswordService,
            SkillRepository skillRepository,
            CompanyService companyService,
            AccountEmailService accountEmailService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.randomPasswordService = randomPasswordService;
        this.skillRepository = skillRepository;
        this.companyService = companyService;
        this.accountEmailService = accountEmailService;
    }

    /**
     * Creates a user (admin only via API) with a system-generated password. Does not return a session token.
     * Rolls back if the welcome email cannot be sent.
     */
    @Transactional
    public User createUser(AdminCreateUserRequest request) {
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
        UserRole role = request.getRoleAsEnum();
        user.setRole(role);
        user.setActive(request.getActive() == null || request.getActive());
        user.setGender(normalizeGenderCode(trimToNull(request.getGender())));
        user.setSkills(resolveSkillsForRole(role, request.getSkillIds()));
        user.setPhoneNumber(trimToNull(request.getPhoneNumber()));
        user.setAddress(trimToNull(request.getAddress()));
        if (role == UserRole.CLIENT) {
            String tax = trimToNull(request.getFiscalMatricule());
            if (tax != null) {
                user.setCompany(companyService.client_company(tax, trimToNull(request.getCompany())));
            }
            user.setClientLabelColor(ClientLabelColors.normalizeOrDefault(request.getClientLabelColor()));
        }

        user.setCreatedAt(LocalDate.now());

        User saved = userRepository.save(user);
        AccountEmailService.WelcomeEmailResult emailResult = accountEmailService.sendWelcomeWithCredentials(
                saved.getEmail(),
                saved.getFirstName() == null ? "there" : saved.getFirstName(),
                saved.getRole() == null ? "User" : saved.getRole().name().replace('_', ' '),
                temporaryPassword
        );

        if (!emailResult.sent()) {
            if (emailResult.skippedBecauseNotConfigured()) {
                throw new IllegalStateException(
                        "Account was not created because outgoing mail is not configured. "
                                + "Set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, and optionally MAIL_FROM."
                );
            }
            throw new IllegalStateException(
                    "Account was not created because the welcome email could not be delivered. "
                            + "For Gmail: enable 2-Step Verification, create an App Password at "
                            + "https://myaccount.google.com/apppasswords, set MAIL_PASSWORD (or "
                            + "application-local.properties), then restart the backend."
            );
        }

        return saved;
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
        SkillService.ensureNotArchived(found);
        return new HashSet<>(found);
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.isActive()) {
            throw new IllegalStateException("Account is deactivated. Please contact an administrator.");
        }

        if (user.getRole() == null) {
            throw new IllegalStateException("This account has no role assigned. Ask an administrator to set a role.");
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

    /**
     * Generates a new password, emails it to the user, and persists the encoded password.
     * Always returns the same message when the email is unknown or inactive (no enumeration).
     */
    public String forgotPassword(String email) {
        String normalized = normalizeEmail(email);
        if (normalized == null || normalized.isEmpty()) {
            throw new IllegalArgumentException("Email is required.");
        }

        var userOpt = userRepository.findByEmail(normalized);
        if (userOpt.isEmpty() || !userOpt.get().isActive()) {
            return FORGOT_PASSWORD_GENERIC_MESSAGE;
        }

        User user = userOpt.get();
        String newPassword = randomPasswordService.generateTemporaryPassword();
        AccountEmailService.WelcomeEmailResult emailResult = accountEmailService.sendPasswordResetEmail(
                user.getEmail(),
                user.getFirstName(),
                newPassword
        );

        if (!emailResult.sent() && !emailResult.skippedBecauseNotConfigured()) {
            throw new IllegalStateException(
                    "Could not send the password reset email. Check mail settings or try again later."
            );
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return FORGOT_PASSWORD_GENERIC_MESSAGE;
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    /** Accepts FEMALE, MALE, OTHER (diagram Gender). */
    private static String normalizeGenderCode(String normalizedOrNull) {
        if (normalizedOrNull == null) {
            return null;
        }
        String u = normalizedOrNull.toUpperCase(Locale.ROOT);
        if (u.equals("FEMALE") || u.equals("MALE") || u.equals("OTHER")) {
            return u;
        }
        throw new IllegalArgumentException("gender must be FEMALE, MALE, or OTHER");
    }

}
