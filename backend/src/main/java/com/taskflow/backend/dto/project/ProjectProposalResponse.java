package com.taskflow.backend.dto.project;

import com.taskflow.backend.entity.ProjectProposal;
import com.taskflow.backend.entity.User;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ProjectProposalResponse {
    private Long id;
    private String name;
    private String description;
    private String clientContact;
    private Long proposerId;
    private String proposerFirstName;
    private String proposerLastName;
    private String proposerEmail;
    private String proposerRole;
    private LocalDateTime createdAt;

    public static ProjectProposalResponse from(ProjectProposal p) {
        ProjectProposalResponse r = new ProjectProposalResponse();
        r.setId(p.getId());
        r.setName(p.getName());
        r.setDescription(p.getDescription());
        r.setClientContact(p.getClientContact());
        r.setCreatedAt(p.getCreatedAt());
        User proposer = p.getProposer();
        if (proposer != null) {
            r.setProposerId(proposer.getId());
            r.setProposerFirstName(proposer.getFirstName());
            r.setProposerLastName(proposer.getLastName());
            r.setProposerEmail(proposer.getEmail());
            r.setProposerRole(proposer.getRole() != null ? proposer.getRole().name() : null);
        }
        return r;
    }
}
