package com.taskflow.backend.controller;

import com.taskflow.backend.dto.project.ProjectProposalRequest;
import com.taskflow.backend.dto.project.ProjectProposalResponse;
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
    public List<ProjectProposalResponse> listProposals() {
        return projectProposalService.listProposals();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getProposal(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(projectProposalService.getProposal(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
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
