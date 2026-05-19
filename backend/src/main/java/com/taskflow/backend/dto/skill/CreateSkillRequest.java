package com.taskflow.backend.dto.skill;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateSkillRequest {
    private String name;
    /** Optional free-form description shown in the catalog. */
    private String description;
}
