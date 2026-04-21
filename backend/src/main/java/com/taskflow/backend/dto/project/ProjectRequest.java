package com.taskflow.backend.dto.project;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class ProjectRequest {
    private String name;
    private String description;
    private LocalDate deadline;
}
