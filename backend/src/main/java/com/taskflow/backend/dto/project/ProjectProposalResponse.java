package com.taskflow.backend.dto.project;

import com.taskflow.backend.entity.ProjectProposal;
import com.taskflow.backend.entity.User;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
public class ProjectProposalResponse {
    private Long id;
    private String name;
    private String description;
    private LocalDate deadline;
    /** PENDING, APPROVED, DISCARDED */
    private String status;
    private Long proposerId;
    private String proposerFirstName;
    private String proposerLastName;
    private String proposerEmail;
    private String proposerRole;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;
    private Long reviewedById;
    private String reviewedByFirstName;
    private String reviewedByLastName;
    private String reviewedByEmail;
    private Long resultingProjectId;

    public static ProjectProposalResponse from(ProjectProposal p) {
        ProjectProposalResponse r = new ProjectProposalResponse();
        r.setId(p.getId());
        r.setName(p.getName());
        r.setDescription(p.getDescription());
        r.setDeadline(p.getDeadline());
        r.setStatus(p.getStatus() != null ? p.getStatus().name() : "PENDING");
        r.setCreatedAt(p.getCreatedAt());
        r.setReviewedAt(p.getReviewedAt());
        r.setResultingProjectId(p.getResultingProjectId());
        User proposer = p.getProposer();
        if (proposer != null) {
            r.setProposerId(proposer.getId());
            r.setProposerFirstName(proposer.getFirstName());
            r.setProposerLastName(proposer.getLastName());
            r.setProposerEmail(proposer.getEmail());
            r.setProposerRole(proposer.getRole() != null ? proposer.getRole().name() : null);
        }
        User reviewer = p.getReviewedBy();
        if (reviewer != null) {
            r.setReviewedById(reviewer.getId());
            r.setReviewedByFirstName(reviewer.getFirstName());
            r.setReviewedByLastName(reviewer.getLastName());
            r.setReviewedByEmail(reviewer.getEmail());
        }
        return r;
    }
}
