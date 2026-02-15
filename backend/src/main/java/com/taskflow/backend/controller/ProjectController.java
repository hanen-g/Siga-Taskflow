package com.taskflow.backend.controller;

import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.ProjectService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
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
    public List<Project> getAllProjects() {
        return projectService.getAllProjects();
    }
    @GetMapping("/my-projects")

    public List<ProjectResponse> myProjects(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectService.myProjects(userDetails.getUser());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")

    public Project updateProject(@PathVariable Long id, @RequestBody Project projectDetails) {
        return projectService.updateProject(id, projectDetails);
    }

    @DeleteMapping("/{id}")
    public void deleteProject(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        projectService.deleteProject(id, userDetails.getUser());
    }


}
