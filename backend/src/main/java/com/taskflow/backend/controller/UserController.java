package com.taskflow.backend.controller;

import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, JwtService jwtService, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/collaborators")
    public ResponseEntity<List<String>> getCollaboratorEmails(
            @RequestParam(name = "q", defaultValue = "") String query
    ) {
        String normalizedQuery = query.trim();

        List<String> collaboratorEmails = userRepository
                .findTop10ActiveByRoleAndEmail(UserRole.COLLABORATOR, normalizedQuery)
                .stream()
                .limit(10)
                .map(User::getEmail)
                .toList();

        return ResponseEntity.ok(collaboratorEmails);
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
            String newEmail = request.getEmail().trim();
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

        public AdminUserResponse(User user) {
            this.id = user.getId();
            this.email = user.getEmail();
            this.firstName = user.getFirstName();
            this.lastName = user.getLastName();
            this.role = user.getRole().name();
            this.profilePicture = user.getProfilePicture();
            this.isActive = user.isActive();
        }

        public Long getId() { return id; }
        public String getEmail() { return email; }
        public String getFirstName() { return firstName; }
        public String getLastName() { return lastName; }
        public String getRole() { return role; }
        public String getProfilePicture() { return profilePicture; }
        public boolean isActive() { return isActive; }
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

        public String getFirstName() { return firstName; }
        public void setFirstName(String firstName) { this.firstName = firstName; }
        public String getLastName() { return lastName; }
        public void setLastName(String lastName) { this.lastName = lastName; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
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
}
