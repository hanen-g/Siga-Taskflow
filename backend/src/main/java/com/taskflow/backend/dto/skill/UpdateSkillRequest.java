package com.taskflow.backend.dto.skill;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateSkillRequest {

    private String name;
    private String description;
}
