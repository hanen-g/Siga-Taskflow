package com.taskflow.backend.controller;

import com.taskflow.backend.dto.reporting.AdminDashboardResponse;
import com.taskflow.backend.dto.reporting.AdminProjectFilterRequest;
import com.taskflow.backend.dto.reporting.AdminProjectFilterResponse;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

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

    @GetMapping("/admin/advanced-filter")
    @PreAuthorize("hasRole('ADMIN')")
    public AdminProjectFilterResponse adminAdvancedFilter(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String projectName,
            @RequestParam(required = false) String managerName,
            @RequestParam(required = false) String collaboratorName,
            @RequestParam(required = false) String skillName,
            @RequestParam(required = false) String statusLabel,
            @RequestParam(required = false) LocalDate startDateFrom,
            @RequestParam(required = false) LocalDate startDateTo,
            @RequestParam(required = false) LocalDate deadlineFrom,
            @RequestParam(required = false) LocalDate deadlineTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return dashboardReportingService.filterAdminProjects(
                userDetails.getUser(),
                new AdminProjectFilterRequest(
                        projectName,
                        managerName,
                        collaboratorName,
                        skillName,
                        statusLabel,
                        startDateFrom,
                        startDateTo,
                        deadlineFrom,
                        deadlineTo
                ),
                page,
                size
        );
    }

    @GetMapping("/client")
    @PreAuthorize("hasRole('CLIENT')")
    public ClientDashboardResponse client(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return dashboardReportingService.clientDashboard(userDetails.getUser());
    }
}
