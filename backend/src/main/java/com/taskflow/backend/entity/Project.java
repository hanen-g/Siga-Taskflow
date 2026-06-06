package com.taskflow.backend.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonProperty.Access;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Getter
@Setter
@Entity
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProjectStatus status = ProjectStatus.IN_PROGRESS;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne
    @JoinColumn(name = "manager_id")
    private User manager;
    @ManyToMany
    @JoinTable(
            name = "project_users",
            joinColumns = @JoinColumn(name = "project_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> members;
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL)
    private List<Task> tasks = new ArrayList<>();

    @ManyToMany
    @JoinTable(
            name = "project_required_skills",
            joinColumns = @JoinColumn(name = "project_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id")
    )
    private Set<Skill> requiredSkills = new HashSet<>();

    @Transient
    @JsonProperty(value = "consumedProposalId", access = Access.WRITE_ONLY)
    private Long consumedProposalId;

    @Transient
    public boolean isArchived() {
        return getStatus() == ProjectStatus.ARCHIVED;
    }

    public void setArchived(boolean archived) {
        if (archived) {
            this.status = ProjectStatus.ARCHIVED;
        } else if (getStatus() == ProjectStatus.ARCHIVED) {
            this.status = ProjectStatus.IN_PROGRESS;
        }
    }

    @Transient
    public boolean isPaused() {
        return getStatus() == ProjectStatus.PAUSED;
    }

    public void setPaused(boolean paused) {
        if (paused) {
            this.status = ProjectStatus.PAUSED;
        } else if (getStatus() == ProjectStatus.PAUSED) {
            this.status = ProjectStatus.IN_PROGRESS;
        }
    }

    @Transient
    public boolean isDelivered() {
        return getStatus() == ProjectStatus.COMPLETED;
    }

    public void setDelivered(boolean delivered) {
        if (delivered) {
            this.status = ProjectStatus.COMPLETED;
        } else if (getStatus() == ProjectStatus.COMPLETED) {
            this.status = ProjectStatus.IN_PROGRESS;
        }
    }

    public ProjectStatus getStatus() {
        return status == null ? ProjectStatus.IN_PROGRESS : status;
    }

    public void setStatus(ProjectStatus status) {
        this.status = status == null ? ProjectStatus.IN_PROGRESS : status;
    }
}
