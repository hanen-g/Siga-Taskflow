package com.taskflow.backend.controller;

import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.ProjectService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
@RestController
@RequestMapping("/api/projects")
@CrossOrigin
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }


    @PostMapping
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public ProjectResponse createProject(
            @RequestBody Project project,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        project.setManager(userDetails.getUser());
        return projectService.createProject(project);
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
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public List<ProjectResponse> myArchivedProjects(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.myArchivedProjects(userDetails.getUser());
    }

    @GetMapping("/{id}")
    public ProjectResponse getProject(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.getProjectForUser(id, userDetails.getUser());
    }

    @PutMapping("/{id}/archive")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public ProjectResponse archiveProject(
            @PathVariable Long id,
            @RequestParam boolean archived,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.setArchived(id, userDetails.getUser(), archived);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
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
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public ProjectResponse uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return projectService.addAttachment(id, file, userDetails.getUser());
    }

    @DeleteMapping("/{id}")
    public void deleteProject(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        projectService.deleteProject(id, userDetails.getUser());
    }


}
