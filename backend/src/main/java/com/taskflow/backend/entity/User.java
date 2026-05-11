package com.taskflow.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String profilePicture; // URL/base64 as string
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(length = 32)
    private String gender;

    @Column(name = "created_at", updatable = false)
    private LocalDate createdAt;


    @Column(length = 64)
    @Enumerated(EnumType.STRING)
    private UserRole role;


    @ManyToMany(mappedBy = "members")
    private Set<Project> projects;

    @ManyToMany
    @JoinTable(
            name = "user_skills",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    private Set<Skill> skills = new HashSet<>();

    public boolean isActive() {
        return isActive == null || isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }
}
