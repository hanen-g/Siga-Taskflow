package com.taskflow.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Optional;
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

    /**
     * When a project is paused, non-done tasks that are not already on hold store their prior status here
     * so they can be restored when the project is resumed.
     */
    @Enumerated(EnumType.STRING)
    @Column
    private TaskStatus statusBeforeProjectPause;

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

    /**
     * Task reports and similar flows assume at most one assigned collaborator.
     * When there is exactly one assignee, that user is the reporter for reports on this task.
     */
    public Optional<User> soleAssignedCollaborator() {
        if (collaborators == null || collaborators.isEmpty()) {
            return Optional.empty();
        }
        if (collaborators.size() != 1) {
            return Optional.empty();
        }
        User u = collaborators.iterator().next();
        return u == null || u.getId() == null ? Optional.empty() : Optional.of(u);
    }
}
