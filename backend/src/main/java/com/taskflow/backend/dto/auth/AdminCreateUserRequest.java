package com.taskflow.backend.dto.auth;

import com.taskflow.backend.entity.UserRole;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class AdminCreateUserRequest {

    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private List<Long> skillIds;

    /** E.164 or local-format phone; optional. */
    private String phoneNumber;

    private String address;
    private LocalDate dateOfBirth;
    /** When null, new accounts default to active. */
    private Boolean active;

    private String gender;
    private LocalDate recruitmentDate;
    private String company;
    private String fiscalMatricule;

    /** CLIENT only: hex from admin palette (#rrggbb). */
    private String clientLabelColor;

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
