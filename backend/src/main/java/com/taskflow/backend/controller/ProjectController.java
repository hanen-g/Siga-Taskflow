package com.taskflow.backend.controller;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.service.ProjectService;
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
    public Project createProject(@RequestBody Project project) {
        return projectService.createProject(project);
    }


    @GetMapping
    public List<Project> getAllProjects() {
        return projectService.getAllProjects();
    }
}
