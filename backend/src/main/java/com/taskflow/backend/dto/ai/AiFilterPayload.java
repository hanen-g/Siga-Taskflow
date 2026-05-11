package com.taskflow.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
public class AiFilterPayload {
    private String projectName;
    private String projectManagerName;
    private String projectStatus;
    private String startDateFrom;
    private String startDateTo;
    private String deadlineFrom;
    private String deadlineTo;
    private String collaboratorName;
    private String taskStatus;
    private String taskPriority;
    private List<String> skills = new ArrayList<>();
    private Double minCompletionRate;
    private Double maxCompletionRate;
    private Boolean hasOverdueTasks;
    private Boolean hasBlockedTasks;

    /** If true UI should render task-focused cards (optional heuristic from backend). */
    private Boolean preferTaskResults;

    /** After applying filters backend may clear removed keys coming from UX chips. */
    public boolean hasAnyFilter() {
        if (skills != null) {
            for (String s : skills) {
                if (s != null && !s.isBlank()) {
                    return true;
                }
            }
        }
        return (projectName != null && !projectName.isBlank())
                || (projectManagerName != null && !projectManagerName.isBlank())
                || (projectStatus != null && !projectStatus.isBlank())
                || (startDateFrom != null && !startDateFrom.isBlank())
                || (startDateTo != null && !startDateTo.isBlank())
                || (deadlineFrom != null && !deadlineFrom.isBlank())
                || (deadlineTo != null && !deadlineTo.isBlank())
                || (collaboratorName != null && !collaboratorName.isBlank())
                || (taskStatus != null && !taskStatus.isBlank())
                || (taskPriority != null && !taskPriority.isBlank())
                || minCompletionRate != null
                || maxCompletionRate != null
                || hasOverdueTasks != null
                || hasBlockedTasks != null;
    }
}
