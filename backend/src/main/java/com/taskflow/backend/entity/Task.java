package com.taskflow.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(
        columnDefinition = "ENUM('TODO','IN_PROGRESS','ON_HOLD','IN_REVIEW','DONE')"
    )
    private TaskStatus status;

    @Column
    private String holdReason;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private LocalDateTime deadline;

    @ManyToOne
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToMany
    @JoinTable(
        name = "task_collaborators",
        joinColumns = @JoinColumn(name = "task_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> collaborators;

    /** Subset of the project's required skills that apply to this task (for assignment matching). */
    @ManyToMany
    @JoinTable(
            name = "task_skills",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    private Set<Skill> skills = new HashSet<>();
}
