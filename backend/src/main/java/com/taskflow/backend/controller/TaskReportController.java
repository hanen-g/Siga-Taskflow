package com.taskflow.backend.controller;

import com.taskflow.backend.dto.task.TaskReportRequest;
import com.taskflow.backend.dto.task.TaskReportResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.TaskReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/task-reports")
@RequiredArgsConstructor
public class TaskReportController {

    private final TaskReportService taskReportService;

    @PostMapping("/tasks/{taskId:\\d+}")
    @PreAuthorize("hasAnyRole('COLLABORATOR', 'PROJECT_MANAGER')")
    public TaskReportResponse createReport(
            @PathVariable Long taskId,
            @RequestBody TaskReportRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskReportService.createReport(taskId, request, userDetails.getUser());
    }

    @GetMapping("/manager")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public List<TaskReportResponse> getManagerReports(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return taskReportService.getOpenReportsForManager(userDetails.getUser());
    }

    @PatchMapping("/{reportId:\\d+}/resolve")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public void resolveReport(
            @PathVariable Long reportId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        taskReportService.resolveReport(reportId, userDetails.getUser());
    }
}
