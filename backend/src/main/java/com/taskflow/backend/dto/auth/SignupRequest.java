package com.taskflow.backend.dto.auth;

import com.taskflow.backend.entity.UserRole;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SignupRequest {

    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String role;


    public UserRole getRoleAsEnum() {
        if (role == null) {
            throw new IllegalArgumentException("Role is required");
        }
        try {
            return UserRole.valueOf(role.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + role + ". Must be PROJECT_MANAGER, COLLABORATOR, CLIENT or ADMIN");
        }
    }
}
