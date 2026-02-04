package com.taskflow.backend.service;

import com.taskflow.backend.dto.AuthResponse;
import com.taskflow.backend.dto.LoginRequest;
import com.taskflow.backend.dto.SignupRequest;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse signup(SignupRequest request) {
        if (request.getRole() == null) {
            throw new IllegalArgumentException("Role is required. Must be PROJECT_MANAGER or COLLABORATOR.");
        }
        if (!request.getRole().equals(UserRole.PROJECT_MANAGER) && !request.getRole().equals(UserRole.COLLABORATOR)) {
            throw new IllegalArgumentException("Role must be PROJECT_MANAGER or COLLABORATOR.");
        }

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());

        user = userRepository.save(user);

        String token = jwtService.generateToken(user.getEmail());
        return new AuthResponse(token, user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        String token = jwtService.generateToken(user.getEmail());
        return new AuthResponse(token, user);
    }
}
