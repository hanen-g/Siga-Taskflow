package com.taskflow.backend.dto.reporting;

import java.util.List;

public record AdminProjectFilterOptionsResponse(
        List<String> projectNames,
        List<String> managerNames,
        List<String> userNames,
        List<String> skillNames,
        List<AdminFilterRoleUserOption> projectManagerUsers,
        List<AdminFilterRoleUserOption> collaboratorUsers,
        List<AdminFilterRoleUserOption> clientUsers
) {}
