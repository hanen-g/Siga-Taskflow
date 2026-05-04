package com.taskflow.backend.dto.task;

import com.taskflow.backend.entity.Task;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
public class TaskResponse {

    private Long id;
    private String title;
    private String description;
    private String status;
    private String priority;
    private LocalDateTime deadline;
    private List<String> collaboratorEmails;
    private String projectName;
    private String holdReason;


    public static TaskResponse fromTask(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus() != null ? task.getStatus().name() : null,
                task.getPriority() != null ? task.getPriority().name() : null,
                task.getDeadline(),
                task.getCollaborators() != null
                        ? task.getCollaborators().stream()
                                .map(u -> u != null ? u.getEmail() : null)
                                .toList()
                        : List.of(),
                task.getProject() != null ? task.getProject().getName() : null,
                task.getHoldReason()

        );
    }

    /** Same as {@link #fromTask(Task)} but hides assignee emails (client-facing progress view). */
    public static TaskResponse fromTaskForClient(Task task) {
        TaskResponse r = fromTask(task);
        r.setCollaboratorEmails(List.of());
        return r;
    }
}
