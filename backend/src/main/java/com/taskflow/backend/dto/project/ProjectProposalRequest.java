package com.taskflow.backend.dto.project;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ProjectProposalRequest {
    private String name;
    private String description;

    /** Incoming JSON uses {@code clientContact}; {@code clientName} is accepted for backward compatibility. */
    @JsonAlias("clientName")
    private String clientContact;
}
