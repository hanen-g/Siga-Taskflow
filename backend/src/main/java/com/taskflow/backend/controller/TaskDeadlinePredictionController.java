package com.taskflow.backend.controller;

import com.taskflow.backend.dto.task.TaskDeadlinePredictionRequest;
import com.taskflow.backend.dto.task.TaskDeadlinePredictionResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.TaskDeadlinePredictionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskDeadlinePredictionController {

    private final TaskDeadlinePredictionService taskDeadlinePredictionService;

    @PostMapping("/predict-deadline")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public TaskDeadlinePredictionResponse predictDeadline(
            @RequestBody TaskDeadlinePredictionRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskDeadlinePredictionService.predict(request, userDetails.getUser());
    }
}
