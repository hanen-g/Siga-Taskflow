package com.taskflow.backend.dto.auth;

import com.taskflow.backend.entity.UserRole;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SignupRequest {

    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String role;


    public SignupRequest(String firstName, String lastName, String email, String password, String role) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.password = password;
        this.role = role;
    }


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
