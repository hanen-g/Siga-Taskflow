package com.taskflow.backend.controller;

import com.taskflow.backend.dto.project.AssigneeCandidateResponse;
import com.taskflow.backend.dto.project.ProjectLifecycleRequest;
import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.dto.skill.ProjectSkillMatchResponse;
import com.taskflow.backend.dto.skill.SkillIdsRequest;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.repository.UserRepository;
import com.taskflow.backend.security.CustomUserDetails;
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
    private final UserRepository userRepository;

    public ProjectController(ProjectService projectService, UserRepository userRepository) {
        this.projectService = projectService;
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
        return ResponseEntity.ok(projectService.createProject(project));
    }


    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ProjectResponse> getAllProjects() {
        return projectService.getAllProjects();
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
