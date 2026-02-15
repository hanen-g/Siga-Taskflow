package com.taskflow.backend.service;

import com.taskflow.backend.dto.project.ProjectResponse;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.repository.ProjectRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;

    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    @Transactional
    public ProjectResponse createProject(Project project) {
        Project saved = projectRepository.save(project);
        return ProjectResponse.fromProject(saved);
    }

    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }
    public List<Project> getProjectsForManager(User manager) {
        return projectRepository.findByManager(manager);
    }
    public Project updateProject(Long id, Project details) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        project.setName(details.getName());
        project.setDescription(details.getDescription());
        return projectRepository.save(project);
    }

    public void deleteProject(Long projectId, User manager) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (!project.getManager().getId().equals(manager.getId())) {
            throw new RuntimeException("Unauthorized");
        }

        projectRepository.delete(project);
    }
    public List<ProjectResponse> myProjects(User manager) {
        return projectRepository.findByManager(manager)
                .stream()
                .map(ProjectResponse::fromProject)
                .toList();
    }



}
