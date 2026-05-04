package com.taskflow.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "project_proposals")
public class ProjectProposal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    @Column(length = 4000)
    private String description;
    private LocalDate deadline;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ProjectProposalStatus status = ProjectProposalStatus.PENDING;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "proposer_id")
    private User proposer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by_id")
    private User reviewedBy;

    /** When approved or discarded (admin action). */
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "resulting_project_id")
    private Long resultingProjectId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private LocalDateTime createdAt;

    public boolean isPending() {
        return status == null || status == ProjectProposalStatus.PENDING;
    }
}
