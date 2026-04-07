package com.taskflow.backend.controller;

import com.taskflow.backend.dto.task.TaskRequest;
import com.taskflow.backend.dto.task.TaskResponse;
import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
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
    @GetMapping("/project/{projectId}")
    public List<TaskResponse> getTasksByProject(@PathVariable Long projectId) {
        return taskService.getTasksByProject(projectId);
    }
    @DeleteMapping("/{id}")
    public void deleteProject(@PathVariable Long id) {
            taskService.deleteTask(id);
    }
    @GetMapping("/my-tasks")
    public List<TaskResponse> myTasks(
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return taskService.getCollaboratorTasks(userDetails.getUser());    }



}

