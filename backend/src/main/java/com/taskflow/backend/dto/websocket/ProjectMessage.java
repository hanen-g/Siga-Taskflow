package com.taskflow.backend.dto.websocket;

import com.taskflow.backend.dto.project.ProjectResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectMessage {
    private String type; // CREATED, UPDATED, DELETED
    private ProjectResponse project;
}
