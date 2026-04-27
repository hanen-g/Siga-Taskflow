package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ApproveProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalResponse;
import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.entity.*;
import com.taskflow.backend.repository.ProjectProposalRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ProjectProposalService {

    private final ProjectProposalRepository projectProposalRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;

    public ProjectProposalService(
            ProjectProposalRepository projectProposalRepository,
            UserRepository userRepository,
            ProjectService projectService
    ) {
        this.projectProposalRepository = projectProposalRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
    }

    @Transactional
    public ProjectProposalResponse submit(User proposer, ProjectProposalRequest request) {
        if (proposer.getRole() != UserRole.PROJECT_MANAGER && proposer.getRole() != UserRole.COLLABORATOR) {
            throw new IllegalArgumentException("Only project managers and collaborators can submit proposals.");
        }
        String name = request.getName() == null ? null : request.getName().trim();
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Project name is required.");
        }
        ProjectProposal p = new ProjectProposal();
        p.setName(name);
        p.setDescription(request.getDescription());
        p.setDeadline(request.getDeadline());
        p.setProposer(proposer);
        p = projectProposalRepository.save(p);
        return toResponse(projectProposalRepository.findByIdWithProposer(p.getId()).orElse(p));
    }

    @Transactional(readOnly = true)
    public List<ProjectProposalResponse> listForAdmin() {
        return projectProposalRepository
                .findAllWithProposerOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectProposalResponse get(Long id) {
        return projectProposalRepository.findByIdWithProposer(id)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Proposal not found"));
    }

    @Transactional
    public ProjectResponse approve(User admin, Long proposalId, ApproveProjectProposalRequest body) {
        if (admin.getRole() != UserRole.ADMIN) {
            throw new SecurityException("Only administrators can approve proposals.");
        }
        ProjectProposal proposal = projectProposalRepository.findByIdWithProposer(proposalId)
                .orElseThrow(() -> new IllegalArgumentException("Proposal not found"));
        User proposer = userRepository.findById(proposal.getProposer().getId())
                .orElseThrow(() -> new IllegalStateException("Proposer not found"));

        User manager;
        if (proposer.getRole() == UserRole.PROJECT_MANAGER) {
            manager = proposer;
        } else {
            if (body.getManagerId() == null) {
                throw new IllegalArgumentException("A project manager must be selected to approve a collaborator's proposal.");
            }
            manager = userRepository.findById(body.getManagerId())
                    .orElseThrow(() -> new IllegalArgumentException("Manager not found"));
            if (manager.getRole() != UserRole.PROJECT_MANAGER) {
                throw new IllegalArgumentException("The selected user is not a project manager.");
            }
        }

        Project project = new Project();
        project.setName(proposal.getName());
        project.setDescription(proposal.getDescription());
        project.setDeadline(proposal.getDeadline());
        project.setManager(manager);
        project.setArchived(false);
        Set<User> members = new HashSet<>();
        members.add(proposer);
        if (!proposer.getId().equals(manager.getId())) {
            members.add(manager);
        }
        project.setMembers(members);

        ProjectResponse created = projectService.createProject(project);

        proposal.setReviewedBy(admin);
        proposal.setResultingProjectId(created.getId());
        projectProposalRepository.delete(proposal);

        return created;
    }

    @Transactional
    public void discard(User admin, Long proposalId) {
        if (admin.getRole() != UserRole.ADMIN) {
            throw new SecurityException("Only administrators can discard proposals.");
        }
        ProjectProposal proposal = projectProposalRepository.findByIdWithProposer(proposalId)
                .orElseThrow(() -> new IllegalArgumentException("Proposal not found"));
        projectProposalRepository.delete(proposal);
    }

    private ProjectProposalResponse toResponse(ProjectProposal p) {
        return ProjectProposalResponse.from(p);
    }
}
