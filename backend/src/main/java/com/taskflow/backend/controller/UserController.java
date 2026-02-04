package com.taskflow.backend.controller;

import com.taskflow.backend.dto.UserResponse;
import com.taskflow.backend.entity.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @GetMapping("/me")
    public UserResponse profile() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Object principal = auth.getPrincipal();
        if (!(principal instanceof User user)) {
            throw new RuntimeException("Not authenticated");
        }
        return UserResponse.from(user);
    }
}
