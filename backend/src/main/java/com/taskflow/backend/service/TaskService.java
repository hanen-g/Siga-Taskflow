package com.taskflow.backend.service;

import com.taskflow.backend.dto.task.TaskRequest;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.repository.ProjectRepository;
import com.taskflow.backend.repository.TaskRepository;
import com.taskflow.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    public Task createTask(TaskRequest request, User manager) {

        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (!project.getManager().getId().equals(manager.getId())) {
            throw new RuntimeException("Not your project");
        }

        User collaborator = userRepository.findByEmail(request.getCollaboratorEmail())
                .orElseThrow(() -> new RuntimeException("collaborator not found"));

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setProject(project);
        task.setCollaborator(collaborator);
        task.setStatus(TaskStatus.TODO);

        return taskRepository.save(task);
    }
    public List<TaskResponse> getTasksByProject(Long projectId) {
        return taskRepository.findByProjectId(projectId)
                .stream()
                .map(TaskResponse::fromTask)
                .toList();
    }
    public void deleteTask(Long taskId) {
        taskRepository.deleteById(taskId);
    }
    public List<TaskResponse> getCollaboratorTasks(User user) {
        return taskRepository.findByCollaborator(user)
                .stream()
                .map(TaskResponse::fromTask)
                .toList();
    }






}
