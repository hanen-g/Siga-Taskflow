package com.taskflow.backend.controller;

import com.taskflow.backend.dto.project.ProjectRequest;
import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping
    public ProjectResponse createProject(
            @RequestBody ProjectRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        Project project = projectService.createProject(request, userDetails.getUser());
return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                project.getManager().getEmail()
);

    }
}