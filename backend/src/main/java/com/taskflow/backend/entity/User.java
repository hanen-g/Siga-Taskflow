package com.taskflow.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
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

    @Column(length = 40)
    private String phoneNumber;

    /** Adresse complète ; peut contenir plusieurs lignes (rue, complément, CP ville, pays). */
    @Column(length = 1024)
    private String address;

    private LocalDate dateOfBirth;

    /** FEMALE / MALE / OTHER or localized label stored as plain string. */
    @Column(length = 32)
    private String gender;

    /** Hiring / onboarding date when the client relation started. */
    @Column(name = "recruitment_date")
    private LocalDate recruitmentDate;

    @Column(length = 255)
    private String company;

    /** Tax identification (matricule fiscal). */
    @Column(name = "fiscal_matricule", length = 128)
    private String fiscalMatricule;

    /**
     * Persisted as {@link EnumType#STRING} with an explicit length so Hibernate maps to VARCHAR
     * when the schema is created or updated, avoiding rejected values such as PROJECT_MANAGER on narrow ENUMs.
     */
    @Column(length = 64)
    @Enumerated(EnumType.STRING)
    private UserRole role;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

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
