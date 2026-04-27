package com.taskflow.backend.controller;

import com.taskflow.backend.dto.project.ApproveProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalResponse;
import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.ProjectProposalService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/project-proposals")
@CrossOrigin(origins = "http://localhost:4200")
public class ProjectProposalController {

    private final ProjectProposalService projectProposalService;

    public ProjectProposalController(ProjectProposalService projectProposalService) {
        this.projectProposalService = projectProposalService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('PROJECT_MANAGER', 'COLLABORATOR')")
    public ResponseEntity<?> submit(
            @RequestBody ProjectProposalRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(projectProposalService.submit(userDetails.getUser(), request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ProjectProposalResponse> listPending(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectProposalService.listForAdmin();
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approve(
            @PathVariable Long id,
            @RequestBody(required = false) ApproveProjectProposalRequest body,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        try {
            if (body == null) {
                body = new ApproveProjectProposalRequest();
            }
            ProjectResponse project = projectProposalService.approve(userDetails.getUser(), id, body);
            return ResponseEntity.ok(project);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/discard")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> discard(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        try {
            projectProposalService.discard(userDetails.getUser(), id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
