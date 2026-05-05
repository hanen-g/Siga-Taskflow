package com.taskflow.backend.controller;

import com.taskflow.backend.dto.auth.AdminCreateUserRequest;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import com.taskflow.backend.security.JwtService;
import com.taskflow.backend.service.AccountEmailService;
import com.taskflow.backend.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final AccountEmailService accountEmailService;
    private final SkillRepository skillRepository;

    public UserController(
            UserRepository userRepository,
            JwtService jwtService,
            PasswordEncoder passwordEncoder,
            AuthService authService,
            AccountEmailService accountEmailService,
            SkillRepository skillRepository
    ) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.accountEmailService = accountEmailService;
        this.skillRepository = skillRepository;
    }

    @GetMapping("/admin/project-managers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ProjectManagerOption>> getProjectManagersForAdmin() {
        List<ProjectManagerOption> out = userRepository.findByRoleAndActiveIncludingNull(UserRole.PROJECT_MANAGER)
                .stream()
                .map(u -> new ProjectManagerOption(
                        u.getId(),
                        u.getFirstName(),
                        u.getLastName(),
                        u.getEmail()
                ))
                .toList();
        return ResponseEntity.ok(out);
    }

    @GetMapping("/collaborators")
    public ResponseEntity<List<String>> getCollaboratorEmails(
            @RequestParam(name = "q", defaultValue = "") String query
    ) {
        String normalizedQuery = query.trim();

        List<String> assigneeEmails = userRepository
                .findActiveByRolesAndEmailPrefix(
                        EnumSet.of(UserRole.COLLABORATOR, UserRole.PROJECT_MANAGER),
                        normalizedQuery,
                        PageRequest.of(0, 50))
                .stream()
                .map(User::getEmail)
                .toList();

        return ResponseEntity.ok(assigneeEmails);
    }

    @PostMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createUserByAdmin(@RequestBody AdminCreateUserRequest request) {
        try {
            AuthService.ProvisioningResult result = authService.createUserByAdmin(request);
            User user = result.user();
            String plainPassword = result.temporaryPassword();
            boolean emailSent = false;
            String emailMessage;
            try {
                emailSent = accountEmailService.sendWelcomeWithCredentials(
                        user.getEmail(),
                        user.getFirstName() == null ? "there" : user.getFirstName(),
                        user.getRole() == null ? "User" : user.getRole().name().replace('_', ' '),
                        plainPassword
                );
                emailMessage = emailSent
                        ? "A welcome email with sign-in details was sent."
                        : "Account created. Outgoing mail is not configured: set MAIL_HOST (e.g. smtp.gmail.com) and MAIL_PASSWORD, or share credentials manually. When mail is disabled, the same details are written to the server log.";
            } catch (Exception e) {
                emailMessage = "Account created, but the welcome email could not be sent. Share credentials manually or check mail configuration.";
            }
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new AdminUserCreatedResponse(new AdminUserResponse(user), emailSent, emailMessage));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        } catch (RuntimeException e) {
            if ("Email already exists".equals(e.getMessage())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage()));
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AdminUserResponse>> getUsersForAdmin(
            @RequestParam(name = "search", defaultValue = "") String search,
            @RequestParam(name = "role", defaultValue = "ALL") String role,
            @RequestParam(name = "status", defaultValue = "active") String status
    ) {
        boolean activeOnly = !"former".equalsIgnoreCase(status);
        String searchValue = search.trim().toLowerCase(Locale.ROOT);

        List<User> users;
        if ("ALL".equalsIgnoreCase(role)) {
            users = activeOnly ? userRepository.findActiveIncludingNull() : userRepository.findByIsActive(false);
        } else {
            UserRole roleEnum = UserRole.valueOf(role.toUpperCase(Locale.ROOT));
            users = activeOnly ? userRepository.findByRoleAndActiveIncludingNull(roleEnum) : userRepository.findByRoleAndIsActive(roleEnum, false);
        }

        List<AdminUserResponse> result = users.stream()
                .filter(user -> searchValue.isBlank() || userMatchesSearch(user, searchValue))
                .sorted(Comparator.comparing((User u) -> (u.getFirstName() + " " + u.getLastName()).toLowerCase(Locale.ROOT)))
                .map(AdminUserResponse::new)
                .toList();

        return ResponseEntity.ok(result);
    }

    @PutMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateAdminUser(
            @PathVariable Long id,
            @RequestBody AdminUserUpdateRequest request
    ) {
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));

        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName().trim());
        }
        if (request.getLastName() != null) {
            user.setLastName(request.getLastName().trim());
        }
        if (request.getEmail() != null) {
            String newEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
            userRepository.findByEmail(newEmail).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new RuntimeException("Email already exists");
                }
            });
            user.setEmail(newEmail);
        }
        if (request.getRole() != null) {
            user.setRole(UserRole.valueOf(request.getRole().toUpperCase(Locale.ROOT)));
        }
        if (request.getSkillIds() != null) {
            user.setSkills(resolveSkillsForRole(user.getRole(), request.getSkillIds()));
        } else if (user.getRole() != UserRole.PROJECT_MANAGER && user.getRole() != UserRole.COLLABORATOR) {
            user.setSkills(new HashSet<>());
        }

        userRepository.save(user);
        return ResponseEntity.ok(new AdminUserResponse(user));
    }

    @PatchMapping("/admin/users/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateUserStatus(
            @PathVariable Long id,
            @RequestBody UserStatusRequest request
    ) {
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        user.setActive(request.isActive());
        userRepository.save(user);
        return ResponseEntity.ok(new AdminUserResponse(user));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(401).body(new ErrorResponse("Missing or invalid authorization header"));
            }

            String token = authHeader.substring(7);
            String email = jwtService.extractEmail(token);

            if (!jwtService.isTokenValid(token)) {
                return ResponseEntity.status(401).body(new ErrorResponse("Invalid or expired token"));
            }

            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            return ResponseEntity.ok(new UserResponse(user));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(new ErrorResponse("Unauthorized: " + e.getMessage()));
        }
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@RequestHeader("Authorization") String authHeader,
                                           @RequestBody UpdateProfileRequest updateRequest) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(401).body(new ErrorResponse("Missing or invalid authorization header"));
            }

            String token = authHeader.substring(7);
            String email = jwtService.extractEmail(token);

            if (!jwtService.isTokenValid(token)) {
                return ResponseEntity.status(401).body(new ErrorResponse("Invalid or expired token"));
            }

            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            if (updateRequest.getFirstName() != null) {
                user.setFirstName(updateRequest.getFirstName());
            }
            if (updateRequest.getLastName() != null) {
                user.setLastName(updateRequest.getLastName());
            }
            if (updateRequest.getProfilePicture() != null) {
                user.setProfilePicture(updateRequest.getProfilePicture());
            }

            if (updateRequest.getPassword() != null && !updateRequest.getPassword().isEmpty()) {
                if (updateRequest.getCurrentPassword() == null || updateRequest.getCurrentPassword().isEmpty()) {
                    return ResponseEntity.badRequest().body(new ErrorResponse("Current password is required to change password."));
                }

                if (!passwordEncoder.matches(updateRequest.getCurrentPassword(), user.getPassword())) {
                    return ResponseEntity.badRequest().body(new ErrorResponse("Current password is incorrect."));
                }

                user.setPassword(passwordEncoder.encode(updateRequest.getPassword()));
            }

            userRepository.save(user);

            return ResponseEntity.ok(new UserResponse(user));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(new ErrorResponse("Unauthorized: " + e.getMessage()));
        }
    }

    static class UserResponse {
        private Long id;
        private String email;
        private String firstName;
        private String lastName;
        private String role;
        private String profilePicture;

        public UserResponse(User user) {
            this.id = user.getId();
            this.email = user.getEmail();
            this.firstName = user.getFirstName();
            this.lastName = user.getLastName();
            this.role = user.getRole().name();
            this.profilePicture = user.getProfilePicture();
        }

        public Long getId() { return id; }
        public String getEmail() { return email; }
        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
        public String getRole() { return role; }
        public String getProfilePicture() { return profilePicture; }
    }

    static class AdminUserResponse {
        private Long id;
        private String email;
        private String firstName;
        private String lastName;
        private String role;
        private String profilePicture;
        private boolean isActive;
        private String createdAt;
        private List<SkillOption> skills;

        public AdminUserResponse(User user) {
            this.id = user.getId();
            this.email = user.getEmail();
            this.firstName = user.getFirstName();
            this.lastName = user.getLastName();
            this.role = user.getRole().name();
            this.profilePicture = user.getProfilePicture();
            this.isActive = user.isActive();
            this.createdAt = user.getCreatedAt() == null
                    ? null
                    : user.getCreatedAt().atOffset(ZoneOffset.UTC).toString();
            this.skills = user.getSkills() == null
                    ? List.of()
                    : user.getSkills().stream()
                    .map(skill -> new SkillOption(skill.getId(), skill.getName()))
                    .sorted(Comparator.comparing(SkillOption::getName, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        }

        public Long getId() { return id; }
        public String getEmail() { return email; }
        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
        public String getRole() { return role; }
        public String getProfilePicture() { return profilePicture; }
        public boolean isActive() { return isActive; }
        public String getCreatedAt() { return createdAt; }
        public List<SkillOption> getSkills() { return skills; }
    }

    static class AdminUserCreatedResponse {
        private final AdminUserResponse user;
        private final boolean emailSent;
        private final String message;

        public AdminUserCreatedResponse(AdminUserResponse user, boolean emailSent, String message) {
            this.user = user;
            this.emailSent = emailSent;
            this.message = message;
        }

        public AdminUserResponse getUser() {
            return user;
        }

        public boolean isEmailSent() {
            return emailSent;
        }

        public String getMessage() {
            return message;
        }
    }

    static class ErrorResponse {
        private String message;

        public ErrorResponse(String message) {
            this.message = message;
        }

        public String getMessage() {
            return message;
        }
    }

    static class ProjectManagerOption {
        private final Long id;
        private final String firstName;
        private final String lastName;
        private final String email;

        ProjectManagerOption(Long id, String firstName, String lastName, String email) {
            this.id = id;
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
        }

        public Long getId() {
            return id;
        }

        public String getFirstName() {
            return firstName;
        }

        public String getLastName() {
            return lastName;
        }

        public String getEmail() {
            return email;
        }
    }

    static class UpdateProfileRequest {
        private String firstName;
        private String lastName;
        private String password;
        private String currentPassword;
        private String profilePicture;

        public String getFirstName() {
            return firstName;
        }

        public void setFirstName(String firstName) {
            this.firstName = firstName;
        }

        public String getLastName() {
            return lastName;
        }

        public void setLastName(String lastName) {
            this.lastName = lastName;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getCurrentPassword() {
            return currentPassword;
        }

        public void setCurrentPassword(String currentPassword) {
            this.currentPassword = currentPassword;
        }

        public String getProfilePicture() {
            return profilePicture;
        }

        public void setProfilePicture(String profilePicture) {
            this.profilePicture = profilePicture;
        }
    }

    static class AdminUserUpdateRequest {
        private String firstName;
        private String lastName;
        private String email;
        private String role;
        private List<Long> skillIds;

        public String getFirstName() { return firstName; }
        public void setFirstName(String firstName) { this.firstName = firstName; }
        public String getLastName() { return lastName; }
        public void setLastName(String lastName) { this.lastName = lastName; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public List<Long> getSkillIds() { return skillIds; }
        public void setSkillIds(List<Long> skillIds) { this.skillIds = skillIds; }
    }

    static class SkillOption {
        private final Long id;
        private final String name;

        SkillOption(Long id, String name) {
            this.id = id;
            this.name = name;
        }

        public Long getId() { return id; }
        public String getName() { return name; }
    }

    static class UserStatusRequest {
        private boolean active;

        public boolean isActive() { return active; }
        public void setActive(boolean active) { this.active = active; }
    }

    private boolean userMatchesSearch(User user, String searchValue) {
        String fullName = ((user.getFirstName() == null ? "" : user.getFirstName()) + " " + (user.getLastName() == null ? "" : user.getLastName()))
                .toLowerCase(Locale.ROOT);
        String email = user.getEmail() == null ? "" : user.getEmail().toLowerCase(Locale.ROOT);
        return fullName.contains(searchValue) || email.contains(searchValue);
    }

    private Set<Skill> resolveSkillsForRole(UserRole role, List<Long> skillIds) {
        if (role != UserRole.PROJECT_MANAGER && role != UserRole.COLLABORATOR) {
            return new HashSet<>();
        }
        if (skillIds == null || skillIds.isEmpty()) {
            return new HashSet<>();
        }
        List<Long> uniqueIds = skillIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        List<Skill> found = skillRepository.findAllById(uniqueIds);
        if (found.size() != uniqueIds.size()) {
            throw new RuntimeException("One or more selected skills are invalid.");
        }
        return new HashSet<>(found);
    }
}
