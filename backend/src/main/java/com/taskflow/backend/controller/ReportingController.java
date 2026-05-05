package com.taskflow.backend.controller;

import com.taskflow.backend.dto.reporting.AdminDashboardResponse;
import com.taskflow.backend.dto.reporting.ClientDashboardResponse;
import com.taskflow.backend.dto.reporting.CollaboratorDashboardResponse;
import com.taskflow.backend.dto.reporting.ProjectManagerDashboardResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.DashboardReportingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reporting")
@RequiredArgsConstructor
public class ReportingController {

    private final DashboardReportingService dashboardReportingService;

    @GetMapping("/collaborator")
    @PreAuthorize("hasRole('COLLABORATOR')")
    public CollaboratorDashboardResponse collaborator(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return dashboardReportingService.collaboratorDashboard(userDetails.getUser());
    }

    @GetMapping("/project-manager")
    @PreAuthorize("hasRole('PROJECT_MANAGER')")
    public ProjectManagerDashboardResponse projectManager(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return dashboardReportingService.projectManagerDashboard(userDetails.getUser());
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public AdminDashboardResponse admin(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return dashboardReportingService.adminDashboard(userDetails.getUser());
    }

    @GetMapping("/client")
    @PreAuthorize("hasRole('CLIENT')")
    public ClientDashboardResponse client(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return dashboardReportingService.clientDashboard(userDetails.getUser());
    }
}
