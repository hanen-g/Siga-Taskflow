package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalResponse;
import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.ProjectProposal;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.ProjectProposalRepository;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ProjectProposalService {

    private final ProjectProposalRepository projectProposalRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    public ProjectProposalService(
            ProjectProposalRepository projectProposalRepository,
            ProjectRepository projectRepository,
            UserRepository userRepository,
            NotificationService notificationService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.projectProposalRepository = projectProposalRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messagingTemplate = messagingTemplate;
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
        String cc = request.getClientContact();
        p.setClientContact(cc == null ? null : cc.trim().isEmpty() ? null : cc.trim());
        p.setProposer(proposer);
        p = projectProposalRepository.save(p);
        notifyAdminsOfNewProposal(p, proposer);
        return toResponse(projectProposalRepository.findByIdWithProposer(p.getId()).orElse(p));
    }

    /**
     * Persist notifications during the transaction; push WebSocket payloads after commit
     * so clients that refetch immediately see rows and STOMP subscribers receive a consistent payload.
     */
    private void notifyAdminsOfNewProposal(ProjectProposal proposal, User submitter) {
        List<User> admins = new ArrayList<>(userRepository.findByRoleAndActiveIncludingNull(UserRole.ADMIN));
        List<Notification> adminPayloads = new ArrayList<>();
        for (User admin : admins) {
            adminPayloads.add(notificationService.createProjectProposalSubmittedNotification(admin, submitter, proposal));
        }

        Runnable publishWs = () -> {
            for (int i = 0; i < admins.size(); i++) {
                messagingTemplate.convertAndSend("/topic/notifications/user/" + admins.get(i).getId(), adminPayloads.get(i));
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publishWs.run();
                }
            });
        } else {
            publishWs.run();
        }
    }

    @Transactional(readOnly = true)
    public List<ProjectProposalResponse> listProposals() {
        return projectProposalRepository.findAllWithProposerOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectProposalResponse getProposal(Long id) {
        return projectProposalRepository.findByIdWithProposer(id)
                .map(this::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("Proposal not found"));
    }

    /**
     * Called after an admin successfully created a project and included {@code consumedProposalId}.
     * Adds the original proposer as a project member, notifies them, and removes the proposal row.
     */
    @Transactional
    public void consumeAfterAdminCreatesProject(User admin, Long proposalId, Long createdProjectId) {
        if (proposalId == null || createdProjectId == null) {
            return;
        }
        if (admin.getRole() != UserRole.ADMIN) {
            throw new SecurityException("Only administrators can finalize proposal consumption.");
        }
        ProjectProposal proposal = projectProposalRepository.findByIdWithProposer(proposalId).orElse(null);
        if (proposal == null) {
            return;
        }
        User proposer = userRepository.findById(proposal.getProposer().getId())
                .orElseThrow(() -> new IllegalStateException("Proposer not found"));

        Project project = projectRepository.findById(createdProjectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));

        Set<User> members = project.getMembers();
        if (members == null) {
            members = new HashSet<>();
            project.setMembers(members);
        }
        members.add(proposer);
        projectRepository.save(project);

        notifyProposerOfApprovedProposal(proposer, project, admin);
        projectProposalRepository.delete(proposal);
    }

    private void notifyProposerOfApprovedProposal(User proposer, Project project, User admin) {
        Notification dto = notificationService.createProjectAssignedNotification(proposer, admin, project);
        long proposerId = proposer.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/notifications/user/" + proposerId, dto);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/notifications/user/" + proposerId, dto);
        }
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
