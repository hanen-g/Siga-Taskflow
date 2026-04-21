package com.taskflow.backend.controller;

import com.taskflow.backend.dto.task.TaskRequest;
import com.taskflow.backend.dto.task.TaskResponse;
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

    @GetMapping("/project/{projectId:\\d+}")
    public List<TaskResponse> getTasksByProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.getTasksByProject(projectId, userDetails.getUser());
    }

    @DeleteMapping("/{id:\\d+}")
    public void deleteProject(@PathVariable Long id) {
        taskService.deleteTask(id);
    }

    @GetMapping("/my-tasks")
    public List<TaskResponse> myTasks(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.getCollaboratorTasks(userDetails.getUser());
    }

    @GetMapping("/manager-tasks")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public List<TaskResponse> managerTasks(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.getManagerTasks(userDetails.getUser());
    }

    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public List<TaskResponse> getAllTasks() {
        return taskService.getAllTasks();
    }

    @PutMapping("/{id:\\d+}")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public TaskResponse updateTask(
            @PathVariable Long id,
            @RequestBody TaskRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.updateTask(id, request, userDetails.getUser());
    }

    @PutMapping("/{id:\\d+}/status")
    public TaskResponse updateTaskStatus(
            @PathVariable Long id,
            @RequestParam String status,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskService.updateStatus(id, status, userDetails.getUser());
    }
}
