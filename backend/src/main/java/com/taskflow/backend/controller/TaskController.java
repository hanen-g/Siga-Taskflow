package com.taskflow.backend.controller;

import com.taskflow.backend.entity.Task;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping("/my")
    public List<Task> myTasks(
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        return taskService.getMyTasks(userDetails.getUser());
    }
}
