package com.taskflow.backend.controller;

import com.taskflow.backend.dto.project.AssigneeCandidateResponse;
import com.taskflow.backend.dto.project.ClientIdsRequest;
import com.taskflow.backend.dto.project.ClientOptionResponse;
import com.taskflow.backend.dto.project.ClientProjectRowResponse;
import com.taskflow.backend.dto.project.ProjectIdsRequest;
import com.taskflow.backend.dto.project.ProjectLifecycleRequest;
import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.dto.skill.ProjectSkillMatchResponse;
import com.taskflow.backend.dto.skill.SkillIdsRequest;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.exception.UnauthorizedException;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.ProjectProposalService;
import com.taskflow.backend.service.ProjectService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
@RestController
@RequestMapping("/api/projects")
@CrossOrigin
public class ProjectController {

    private final ProjectService projectService;
    private final ProjectProposalService projectProposalService;
    private final UserRepository userRepository;

    public ProjectController(
            ProjectService projectService,
            ProjectProposalService projectProposalService,
            UserRepository userRepository) {
        this.projectService = projectService;
        this.projectProposalService = projectProposalService;
        this.userRepository = userRepository;
    }


    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createProject(
            @RequestBody Project project,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        if (project.getManager() == null || project.getManager().getId() == null) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "A project manager must be assigned (manager.id)."));
        }
        User manager = userRepository.findById(project.getManager().getId())
                .orElse(null);
        if (manager == null) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "Manager not found."));
        }
        if (manager.getRole() != UserRole.PROJECT_MANAGER) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", "The assigned user must be a project manager."));
        }
        project.setManager(manager);
        if (project.getMembers() == null) {
            project.setMembers(new HashSet<>(Set.of(manager)));
        } else {
            project.getMembers().add(manager);
        }
        Long consumedProposalId = project.getConsumedProposalId();
        ProjectResponse created = projectService.createProject(project);
        if (consumedProposalId != null) {
            projectProposalService.consumeAfterAdminCreatesProject(
                    userDetails.getUser(),
                    consumedProposalId,
                    created.getId());
        }
        return ResponseEntity.ok(created);
    }


    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ProjectResponse> getAllProjects() {
        return projectService.getAllProjects();
    }

    /**
     * Suggest project managers for the admin “create project” flow (skills + workload), before a project id exists.
     */
    @GetMapping("/admin/project-manager-candidates")
    @PreAuthorize("hasRole('ADMIN')")
    public List<AssigneeCandidateResponse> listProjectManagerCandidates(
            @RequestParam(name = "skillIds", required = false) List<Long> skillIds,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.listProjectManagerCandidatesForAdmin(skillIds, userDetails.getUser());
    }

    @GetMapping("/admin/clients/{clientId}/projects")
    @PreAuthorize("hasRole('ADMIN')")
    public List<ClientProjectRowResponse> listProjectsForClient(
            @PathVariable Long clientId,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        return projectService.listProjectsForClient(clientId, userDetails.getUser());
    }

    @PostMapping("/admin/clients/{clientId}/projects")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> addClientToProjects(
            @PathVariable Long clientId,
            @RequestBody(required = false) ProjectIdsRequest body,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        try {
            List<Long> ids = body == null ? List.of() : body.getProjectIds();
            projectService.addClientToProjects(clientId, ids, userDetails.getUser());
            return ResponseEntity.ok().build();
        } catch (ResourceNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (BadRequestException | UnauthorizedException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/admin/clients/{clientId}/projects")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> setClientProjects(
            @PathVariable Long clientId,
            @RequestBody(required = false) ProjectIdsRequest body,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        try {
            List<Long> ids = body == null ? List.of() : body.getProjectIds();
            projectService.replaceClientProjects(clientId, ids, userDetails.getUser());
            return ResponseEntity.ok().build();
        } catch (ResourceNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (BadRequestException | UnauthorizedException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/{id}/clients")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> listProjectClients(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        try {
            List<ClientOptionResponse> rows = projectService.listClientsForProject(id, userDetails.getUser());
            return ResponseEntity.ok(rows);
        } catch (ResourceNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (UnauthorizedException e) {
            return ResponseEntity.status(403).body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/{id}/clients")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> setProjectClients(
            @PathVariable Long id,
            @RequestBody(required = false) ClientIdsRequest body,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        try {
            List<Long> ids = body == null ? List.of() : body.getClientIds();
            projectService.setProjectClients(id, ids, userDetails.getUser());
            return ResponseEntity.ok().build();
        } catch (ResourceNotFoundException e) {
            return ResponseEntity.notFound().build();
        } catch (BadRequestException | UnauthorizedException e) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/my-projects")

    public List<ProjectResponse> myProjects(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.myProjects(userDetails.getUser());
    }

    @GetMapping("/archived")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER', 'ADMIN')")
    public List<ProjectResponse> myArchivedProjects(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails.getUser().getRole() == UserRole.ADMIN) {
            return projectService.getAllArchivedForAdmin();
        }
        return projectService.myArchivedProjects(userDetails.getUser());
    }

    @GetMapping("/{id}")
    public ProjectResponse getProject(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.getProjectForUser(id, userDetails.getUser());
    }

    @GetMapping("/{id}/skill-matches")
    public ProjectSkillMatchResponse getProjectSkillMatches(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.getProjectSkillMatches(id, userDetails.getUser());
    }

    @GetMapping("/{id}/assignee-candidates")
    public List<AssigneeCandidateResponse> getAssigneeCandidates(
            @PathVariable Long id,
            @RequestParam(name = "skillIds", required = false) List<Long> skillIds,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.getAssigneeCandidates(id, skillIds, userDetails.getUser());
    }

    @PutMapping("/{id}/required-skills")
    public ProjectResponse setRequiredSkills(
            @PathVariable Long id,
            @RequestBody SkillIdsRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.setRequiredSkillIds(id, request.getSkillIds(), userDetails.getUser());
    }

    @PutMapping("/{id}/archive")
    @PreAuthorize("hasRole('ADMIN')")
    public ProjectResponse archiveProject(
            @PathVariable Long id,
            @RequestParam boolean archived,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.setArchived(id, userDetails.getUser(), archived);
    }

    @PutMapping("/{id}/lifecycle")
    @PreAuthorize("hasRole('ADMIN')")
    public ProjectResponse setProjectLifecycle(
            @PathVariable Long id,
            @RequestBody ProjectLifecycleRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.setProjectLifecycle(id, request, userDetails.getUser());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER', 'ADMIN')")
    public Project updateProject(
            @PathVariable Long id,
            @RequestBody Project projectDetails,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.updateProject(id, projectDetails, userDetails.getUser());
    }

    /**
     * Upload an attachment file and associate it with a project. Only the
     * project manager may perform this operation; the returned response contains
     * the updated project including the attachment URL.
     */
    @PostMapping("/{id}/attachment")
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER', 'ADMIN')")
    public ProjectResponse uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return projectService.addAttachment(id, file, userDetails.getUser());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteProject(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        projectService.deleteProject(id, userDetails.getUser());
    }


}
