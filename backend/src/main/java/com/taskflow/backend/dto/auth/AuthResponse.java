package com.taskflow.backend.dto.auth;

import com.taskflow.backend.entity.User;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthResponse {

    private String token;
    private Long id;
    private String email;
    private String firstName;
    private String lastName;
    private String role;
    private String profilePicture;

    public AuthResponse(String token, User user) {
        this.token = token;
        this.id = user.getId();
        this.email = user.getEmail();
        this.firstName = user.getFirstName();
        this.lastName = user.getLastName();
        this.role = user.getRole().name();
        this.profilePicture = user.getProfilePicture();
    }

}
