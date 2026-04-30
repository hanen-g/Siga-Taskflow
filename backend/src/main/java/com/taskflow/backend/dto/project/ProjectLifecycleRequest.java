package com.taskflow.backend.dto.project;

import lombok.Getter;
import lombok.Setter;

/**
 * Partial update: only non-null fields are applied (admin-only).
 */
@Getter
@Setter
public class ProjectLifecycleRequest {
    private Boolean archived;
    private Boolean paused;
    private Boolean delivered;
}
