package com.taskflow.backend.controller;

import com.taskflow.backend.dto.auth.AdminCreateUserRequest;
import com.taskflow.backend.dto.project.ClientOptionResponse;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import com.taskflow.backend.security.JwtService;
import com.taskflow.backend.service.AuthService;
import com.taskflow.backend.service.CompanyService;
import com.taskflow.backend.service.ProjectService;
import com.taskflow.backend.service.SkillService;
import com.taskflow.backend.util.ClientLabelColors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final SkillRepository skillRepository;
    private final CompanyService companyService;
    private final ProjectService projectService;

    public UserController(
            UserRepository userRepository,
            JwtService jwtService,
            PasswordEncoder passwordEncoder,
            AuthService authService,
            SkillRepository skillRepository,
            CompanyService companyService,
            ProjectService projectService
    ) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.skillRepository = skillRepository;
        this.companyService = companyService;
        this.projectService = projectService;
    }

    @GetMapping("/admin/project-managers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ProjectManagerOption>> getProjectManager() {
        /*
         * JOIN FETCH on a collection duplicates the same User in the JDBC result; without merging,
         * each row can carry an incomplete skills bag and skillIds sent to the client look wrong/empty.
         */
        List<ProjectManagerOption> out = mergeDuplicateUsersMergingSkills(
                        userRepository.findByRoleAndActiveIncludingNullWithSkillsFetched(UserRole.PROJECT_MANAGER))
                .stream()
                .map(u -> {
                    List<Long> skillIds = u.getSkills() == null
                            ? List.of()
                            : u.getSkills().stream()
                                    .filter(s -> !s.isArchived())
                                    .map(Skill::getId)
                                    .distinct()
                                    .sorted()
                                    .toList();
                    return new ProjectManagerOption(
                            u.getId(),
                            u.getFirstName(),
                            u.getLastName(),
                            u.getEmail(),
                            skillIds
                    );
                })
                .toList();
        return ResponseEntity.ok(out);
    }

    /**
     * Collapses duplicate {@link User} rows from {@code JOIN FETCH} on skills into one instance per id
     * with a unified skill set.
     */
    private static List<User> mergeDuplicateUsersMergingSkills(List<User> fetched) {
        Map<Long, User> byId = new LinkedHashMap<>();
        for (User u : fetched) {
            byId.merge(u.getId(), u, (existing, incoming) -> {
                mergeUserSkills(existing, incoming);
                return existing;
            });
        }
        return new ArrayList<>(byId.values());
    }

    private static void mergeUserSkills(User target, User source) {
        if (source.getSkills() == null || source.getSkills().isEmpty()) {
            return;
        }
        if (target.getSkills() == null) {
            target.setSkills(new HashSet<>());
        }
        target.getSkills().addAll(source.getSkills());
    }

    @GetMapping("/admin/clients")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<ClientOptionResponse>> getClients() {
        List<User> users = userRepository.findByRoleAndActiveIncludingNull(UserRole.CLIENT);
        List<ClientOptionResponse> out = users.stream()
                .sorted(Comparator
                        .comparing((User u) -> {
                            String company = u.getCompany() == null || u.getCompany().getCompanyName() == null
                                    ? ""
                                    : u.getCompany().getCompanyName();
                            return company.toLowerCase(Locale.ROOT);
                        })
                        .thenComparing(u -> ((u.getFirstName() == null ? "" : u.getFirstName())
                                + " " + (u.getLastName() == null ? "" : u.getLastName())).toLowerCase(Locale.ROOT)))
                .map(u -> new ClientOptionResponse(
                        u.getId(),
                        u.getFirstName(),
                        u.getLastName(),
                        u.getEmail(),
                        u.getCompany() == null ? null : u.getCompany().getCompanyName(),
                        u.getClientLabelColor()
                ))
                .toList();
        return ResponseEntity.ok(out);
    }

    @GetMapping("/collaborators")
    public ResponseEntity<List<String>> getCollabEmail(
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
    public ResponseEntity<?> createUser(@RequestBody AdminCreateUserRequest request) {
        try {
            User user = authService.createUser(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new AdminUserCreatedResponse(adminUserResponse(user)));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new ErrorResponse(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        } catch (DataIntegrityViolationException e) {
            String msg = messageForDataIntegrityViolation(e);
            HttpStatus status = "Email already exists".equals(msg)
                    ? HttpStatus.CONFLICT
                    : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).body(new ErrorResponse(msg));
        } catch (RuntimeException e) {
            if ("Email already exists".equals(e.getMessage())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage()));
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AdminUserResponse>> getUsers(
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
                .filter(user -> searchValue.isBlank()
                        || userMatchesSearch(user, searchValue))
                .sorted(Comparator.comparing((User u) -> (u.getFirstName() + " " + u.getLastName()).toLowerCase(Locale.ROOT)))
                .map(AdminUserResponse::new)
                .toList();

        return ResponseEntity.ok(result);
    }

    @PutMapping("/admin/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateUser(
            @PathVariable Long id,
            @RequestBody AdminUserUpdateRequest request
    ) {
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));

        try {
            UserRole roleBefore = user.getRole();

            if (request.getRole() != null) {
                UserRole newRole = UserRole.valueOf(request.getRole().toUpperCase(Locale.ROOT));
                if (roleBefore == UserRole.CLIENT && newRole != UserRole.CLIENT) {
                    user.setCompany(null);
                }
                user.setRole(newRole);
            }
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
            if (request.getSkillIds() != null) {
                user.setSkills(resolveSkillsForRole(user.getRole(), request.getSkillIds()));
            } else if (user.getRole() != UserRole.PROJECT_MANAGER && user.getRole() != UserRole.COLLABORATOR) {
                user.setSkills(new HashSet<>());
            }
            if (request.getGender() != null) {
                String trimmed = request.getGender().trim();
                if (trimmed.isEmpty()) {
                    user.setGender(null);
                } else {
                    String u = trimmed.toUpperCase(Locale.ROOT);
                    if (u.equals("FEMALE") || u.equals("MALE") || u.equals("OTHER")) {
                        user.setGender(u);
                    } else {
                        throw new IllegalArgumentException("gender must be FEMALE, MALE, or OTHER");
                    }
                }
            }
            if (request.getPhoneNumber() != null) {
                user.setPhoneNumber(trimToNull(request.getPhoneNumber()));
            }
            if (request.getAddress() != null) {
                user.setAddress(trimToNull(request.getAddress()));
            }

            boolean clientLabelColorChanged = false;
            if (user.getRole() == UserRole.CLIENT) {
                if (request.getFiscalMatricule() != null) {
                    String f = trimToNull(request.getFiscalMatricule());
                    if (f == null) {
                        user.setCompany(null);
                    } else {
                        user.setCompany(companyService.client_company(
                                f,
                                request.getCompany() != null ? trimToNull(request.getCompany()) : null
                        ));
                    }
                } else if (request.getCompany() != null) {
                    companyService.renameCompany(user, request.getCompany());
                }
                if (request.getClientLabelColor() != null) {
                    String previousColor = user.getClientLabelColor();
                    String nextColor = ClientLabelColors.normalizeOrDefault(request.getClientLabelColor());
                    user.setClientLabelColor(nextColor);
                    clientLabelColorChanged = !nextColor.equalsIgnoreCase(previousColor == null ? "" : previousColor.trim());
                }
            }

            userRepository.save(user);
            if (clientLabelColorChanged) {
                projectService.publishProjectUpdatesForClientColor(user.getId());
            }

            return ResponseEntity.ok(adminUserResponse(user));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }
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
        return ResponseEntity.ok(adminUserResponse(user));
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
            if (updateRequest.getPhoneNumber() != null) {
                user.setPhoneNumber(trimToNull(updateRequest.getPhoneNumber()));
            }
            if (updateRequest.getAddress() != null) {
                user.setAddress(trimToNull(updateRequest.getAddress()));
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
        private String createdAt;
        private String phoneNumber;
        private String address;

        public UserResponse(User user) {
            this.id = user.getId();
            this.email = user.getEmail();
            this.firstName = user.getFirstName();
            this.lastName = user.getLastName();
            this.role = user.getRole().name();
            this.profilePicture = user.getProfilePicture();
            this.createdAt = user.getCreatedAt() == null ? null : user.getCreatedAt().toString();
            this.phoneNumber = user.getPhoneNumber();
            this.address = user.getAddress();
        }

        public Long getId() { return id; }
        public String getEmail() { return email; }
        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
        public String getRole() { return role; }
        public String getProfilePicture() { return profilePicture; }
        public String getCreatedAt() { return createdAt; }
        public String getPhoneNumber() { return phoneNumber; }
        public String getAddress() { return address; }
    }

    static class AdminUserResponse {
        private Long id;
        private String email;
        private String firstName;
        private String lastName;
        private String role;
        private String profilePicture;
        private boolean isActive;
        private String phoneNumber;
        private String address;
        private LocalDate dateOfBirth;
        private String gender;
        private LocalDate recruitmentDate;
        private String company;
        private String fiscalMatricule;
        private String createdAt;
        private List<SkillOption> skills;
        private String clientLabelColor;

        public AdminUserResponse(User user) {
            this.id = user.getId();
            this.email = user.getEmail();
            this.firstName = user.getFirstName();
            this.lastName = user.getLastName();
            this.role = user.getRole().name();
            this.profilePicture = user.getProfilePicture();
            this.isActive = user.isActive();
            this.phoneNumber = user.getPhoneNumber();
            this.address = user.getAddress();
            if (user.getRole() == UserRole.CLIENT && user.getCompany() != null) {
                this.company = user.getCompany().getCompanyName();
                this.fiscalMatricule = user.getCompany().getTaxRegistrationNumber();
            } else {
                this.company = null;
                this.fiscalMatricule = null;
            }

            this.gender = user.getGender();
            this.createdAt = user.getCreatedAt() == null
                    ? null
                    : user.getCreatedAt().toString();
            this.skills = user.getSkills() == null
                    ? List.of()
                    : user.getSkills().stream()
                    .map(skill -> new SkillOption(skill.getId(), skill.getName()))
                    .sorted(Comparator.comparing(SkillOption::getName, String.CASE_INSENSITIVE_ORDER))
                    .toList();
            this.clientLabelColor = user.getClientLabelColor();
        }

        public Long getId() { return id; }
        public String getEmail() { return email; }
        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
        public String getRole() { return role; }
        public String getProfilePicture() { return profilePicture; }
        public boolean isActive() { return isActive; }
        public String getPhoneNumber() { return phoneNumber; }
        public String getAddress() { return address; }
        public LocalDate getDateOfBirth() { return dateOfBirth; }
        public String getGender() { return gender; }
        public LocalDate getRecruitmentDate() { return recruitmentDate; }
        public String getCompany() { return company; }
        public String getFiscalMatricule() { return fiscalMatricule; }
        public String getCreatedAt() { return createdAt; }
        public List<SkillOption> getSkills() { return skills; }
        public String getClientLabelColor() { return clientLabelColor; }
    }

    static class AdminUserCreatedResponse {
        private final AdminUserResponse user;

        public AdminUserCreatedResponse(AdminUserResponse user) {
            this.user = user;
        }

        public AdminUserResponse getUser() {
            return user;
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
        /** Non-archived skill ids on this project manager (for admin project creation filtering). */
        private final List<Long> skillIds;

        ProjectManagerOption(Long id, String firstName, String lastName, String email, List<Long> skillIds) {
            this.id = id;
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
            this.skillIds = skillIds == null ? List.of() : List.copyOf(skillIds);
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

        public List<Long> getSkillIds() {
            return skillIds;
        }
    }

    static class UpdateProfileRequest {
        private String firstName;
        private String lastName;
        private String password;
        private String currentPassword;
        private String profilePicture;
        private String phoneNumber;
        private String address;

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

        public String getPhoneNumber() {
            return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
            this.phoneNumber = phoneNumber;
        }

        public String getAddress() {
            return address;
        }

        public void setAddress(String address) {
            this.address = address;
        }
    }

    static class AdminUserUpdateRequest {
        private String firstName;
        private String lastName;
        private String email;
        private String role;
        private List<Long> skillIds;
        private String phoneNumber;
        private String address;
        private LocalDate dateOfBirth;
        private String gender;
        private LocalDate recruitmentDate;
        private String company;
        private String fiscalMatricule;
        private String clientLabelColor;

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
        public String getPhoneNumber() { return phoneNumber; }
        public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
        public LocalDate getDateOfBirth() { return dateOfBirth; }
        public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
        public String getGender() { return gender; }
        public void setGender(String gender) { this.gender = gender; }
        public LocalDate getRecruitmentDate() { return recruitmentDate; }
        public void setRecruitmentDate(LocalDate recruitmentDate) { this.recruitmentDate = recruitmentDate; }
        public String getCompany() { return company; }
        public void setCompany(String company) { this.company = company; }
        public String getFiscalMatricule() { return fiscalMatricule; }
        public void setFiscalMatricule(String fiscalMatricule) { this.fiscalMatricule = fiscalMatricule; }
        public String getClientLabelColor() { return clientLabelColor; }
        public void setClientLabelColor(String clientLabelColor) { this.clientLabelColor = clientLabelColor; }
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

    private AdminUserResponse adminUserResponse(User user) {
        return new AdminUserResponse(user);
    }

    private boolean userMatchesSearch(User user, String searchValue) {
        String fullName = ((user.getFirstName() == null ? "" : user.getFirstName()) + " " + (user.getLastName() == null ? "" : user.getLastName()))
                .toLowerCase(Locale.ROOT);
        String email = user.getEmail() == null ? "" : user.getEmail().toLowerCase(Locale.ROOT);
        String phone = user.getPhoneNumber() == null ? "" : user.getPhoneNumber().toLowerCase(Locale.ROOT);
        String addr = user.getAddress() == null ? "" : user.getAddress().toLowerCase(Locale.ROOT);
        String company = "";
        String fiscal = "";
        if (user.getRole() == UserRole.CLIENT && user.getCompany() != null) {
            company = user.getCompany().getCompanyName() == null ? "" : user.getCompany().getCompanyName().toLowerCase(Locale.ROOT);
            fiscal = user.getCompany().getTaxRegistrationNumber() == null ? "" : user.getCompany().getTaxRegistrationNumber().toLowerCase(Locale.ROOT);
        }
        return fullName.contains(searchValue) || email.contains(searchValue) || phone.contains(searchValue)
                || addr.contains(searchValue) || company.contains(searchValue) || fiscal.contains(searchValue);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
        SkillService.ensureNotArchived(found);
        return new HashSet<>(found);
    }

    private static String messageForDataIntegrityViolation(DataIntegrityViolationException ex) {
        Throwable cause = ex.getMostSpecificCause();
        String raw = cause != null ? cause.getMessage() : ex.getMessage();
        String msg = "Unable to save this user. Check that the email is unique and the role is accepted by the database.";
        if (raw != null) {
            String low = raw.toLowerCase(Locale.ROOT);
            if (low.contains("duplicate") || low.contains("unique")) {
                msg = "Email already exists";
            } else if (low.contains("data truncated") || low.contains("truncated")) {
                msg = "The database refused the stored role (often a too-narrow MySQL ENUM or column). "
                        + "Run: ALTER TABLE users MODIFY COLUMN role VARCHAR(64); then restart the app.";
            }
        }
        return msg;
    }
}

