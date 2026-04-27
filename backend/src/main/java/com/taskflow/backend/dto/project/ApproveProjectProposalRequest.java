package com.taskflow.backend.dto.project;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * When the proposer is a collaborator, the admin must assign a project manager.
 * When the proposer is already a project manager, this field is ignored.
 */
@Getter
@Setter
@NoArgsConstructor
public class ApproveProjectProposalRequest {
    private Long managerId;
}
