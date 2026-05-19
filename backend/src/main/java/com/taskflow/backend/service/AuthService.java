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

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RandomPasswordService randomPasswordService,
            SkillRepository skillRepository,
            CompanyService companyService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.randomPasswordService = randomPasswordService;
        this.skillRepository = skillRepository;
        this.companyService = companyService;
    }

    public record ProvisioningResult(User user, String temporaryPassword) {}

    /**
     * Creates a user (admin only via API) with a system-generated password. Does not return a session token.
     */
    public ProvisioningResult createUser(AdminCreateUserRequest request) {
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

        return new ProvisioningResult(saved, temporaryPassword);
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
