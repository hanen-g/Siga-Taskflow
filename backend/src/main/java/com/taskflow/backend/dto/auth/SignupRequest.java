package com.taskflow.backend.dto.auth;

import com.taskflow.backend.entity.UserRole;
import com.fasterxml.jackson.annotation.JsonProperty;

public class SignupRequest {

    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String role;

    public SignupRequest() {}

    public SignupRequest(String firstName, String lastName, String email, String password, String role) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.password = password;
        this.role = role;
    }

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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public UserRole getRoleAsEnum() {
        if (role == null) {
            throw new IllegalArgumentException("Role is required");
        }
        try {
            return UserRole.valueOf(role.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid role: " + role + ". Must be PROJECT_MANAGER or COLLABORATOR");
        }
    }
}
