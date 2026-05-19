package com.taskflow.backend.dto.project;

import com.taskflow.backend.entity.ProjectStatus;
import lombok.Getter;
import lombok.Setter;

/**
 * Partial update: {@code status} is required. Used for pause, resume, and delivery transitions.
 */
@Getter
@Setter
public class ProjectLifecycleRequest {
    private ProjectStatus status;
}
