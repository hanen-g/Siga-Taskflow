package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ApproveProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalResponse;
import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.entity.*;
import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.repository.ProjectProposalRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDate;
import java.time.LocalDateTime;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ProjectProposalService {

    private final ProjectProposalRepository projectProposalRepository;
    private final UserRepository userRepository;
    private final ProjectService projectService;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    public ProjectProposalService(
            ProjectProposalRepository projectProposalRepository,
            UserRepository userRepository,
            ProjectService projectService,
            NotificationService notificationService,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.projectProposalRepository = projectProposalRepository;
        this.userRepository = userRepository;
        this.projectService = projectService;
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
        p.setDeadline(request.getDeadline());
        p.setProposer(proposer);
        p.setStatus(ProjectProposalStatus.PENDING);
        p = projectProposalRepository.save(p);
        notifyAdminsOfNewProposal(p.getName(), proposer);
        return toResponse(projectProposalRepository.findByIdWithProposer(p.getId()).orElse(p));
    }

    /**
     * Persist notifications in the DB during the transaction, but push WebSocket payloads only after commit
     * so clients that refetch immediately see rows and STOMP subscribers receive a consistent payload.
     */
    private void notifyAdminsOfNewProposal(String proposalName, User submitter) {
        List<User> admins = new ArrayList<>(userRepository.findByRoleAndActiveIncludingNull(UserRole.ADMIN));
        List<Notification> adminPayloads = new ArrayList<>();
        for (User admin : admins) {
            adminPayloads.add(notificationService.createProjectProposalSubmittedNotification(admin, proposalName, submitter));
        }
        Notification receipt = notificationService.createProjectProposalReceiptNotification(submitter, proposalName);
        Long submitterId = submitter.getId();

        Runnable publishWs = () -> {
            for (int i = 0; i < admins.size(); i++) {
                messagingTemplate.convertAndSend("/topic/notifications/user/" + admins.get(i).getId(), adminPayloads.get(i));
            }
            messagingTemplate.convertAndSend("/topic/notifications/user/" + submitterId, receipt);
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
    public List<ProjectProposalResponse> listForAdmin() {
        return projectProposalRepository
                .findPendingWithProposerOrderByCreatedAtDesc(ProjectProposalStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProjectProposalResponse> listForProposer(User proposer) {
        if (proposer.getRole() != UserRole.PROJECT_MANAGER && proposer.getRole() != UserRole.COLLABORATOR) {
            throw new SecurityException("Only project managers and collaborators have proposal history.");
        }
        return projectProposalRepository
                .findMyProposalsWithReviewer(proposer.getId())
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
        if (!proposal.isPending()) {
            throw new IllegalArgumentException("This proposal has already been processed.");
        }
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
        // UI "Not started" = startDate strictly after today; approved ideas should land there until the date passes or an admin edits it.
        project.setStartDate(LocalDate.now().plusDays(1));
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
        proposal.setReviewedAt(LocalDateTime.now());
        proposal.setStatus(ProjectProposalStatus.APPROVED);
        proposal.setResultingProjectId(created.getId());
        projectProposalRepository.save(proposal);

        notifyProposerOfApprovedProposal(proposer, proposal.getName(), created, admin);

        return created;
    }

    private void notifyProposerOfApprovedProposal(
            User proposer,
            String proposalName,
            ProjectResponse created,
            User admin) {
        Notification dto = notificationService.createProjectProposalApprovedNotification(
                proposer, proposalName, created.getName(), admin);
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
        if (!proposal.isPending()) {
            throw new IllegalArgumentException("This proposal has already been processed.");
        }
        proposal.setReviewedBy(admin);
        proposal.setReviewedAt(LocalDateTime.now());
        proposal.setStatus(ProjectProposalStatus.DISCARDED);
        projectProposalRepository.save(proposal);
    }

    private ProjectProposalResponse toResponse(ProjectProposal p) {
        return ProjectProposalResponse.from(p);
    }
}
