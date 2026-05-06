package com.taskflow.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
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

    /** Use explicit length: values like {@code IN_PROGRESS} are 11+ chars (narrow VARCHAR/ENUM causes MySQL truncation). */
    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private TaskStatus status;

    @Column
    private String holdReason;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
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
}
