package com.taskflow.backend.dto.project;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class ProjectProposalRequest {
    private String name;
    private String description;
    private LocalDate deadline;
}
