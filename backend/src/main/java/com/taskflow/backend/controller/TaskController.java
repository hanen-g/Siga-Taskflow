package com.taskflow.backend.controller;

import com.taskflow.backend.dto.task.TaskRequest;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.dto.task.TaskStatusUpdateRequest;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @PostMapping
    public TaskResponse createTask(
            @RequestBody TaskRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Task savedTask = taskService.createTask(request, userDetails.getUser());
        return TaskResponse.fromTask(savedTask);
    }

    /**
     * Cross-project task list for the signed-in user (role-based: admin / PM / collaborator / client empty).
     */
    @GetMapping
    public List<TaskResponse> listTasksForCurrentUser(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.listTasksForCurrentUser(userDetails.getUser());
    }

    @GetMapping("/project/{projectId:\\d+}")
    public List<TaskResponse> getTasksByProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.getTasksByProject(projectId, userDetails.getUser());
    }

    @DeleteMapping("/{id:\\d+}")
    public void deleteTask(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        taskService.deleteTask(id, userDetails.getUser());
    }

    @PutMapping("/{id:\\d+}")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public TaskResponse updateTask(
            @PathVariable Long id,
            @RequestBody TaskRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.updateTask(id, request, userDetails.getUser());
    }

    @PatchMapping("/{id:\\d+}/status")
    public TaskResponse updateTaskStatus(
            @PathVariable Long id,
            @RequestBody TaskStatusUpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.updateStatus(id, request, userDetails.getUser());
    }
}
