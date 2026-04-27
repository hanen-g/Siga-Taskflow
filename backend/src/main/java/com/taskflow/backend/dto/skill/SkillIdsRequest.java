package com.taskflow.backend.dto.skill;

import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SkillIdsRequest {
    private List<Long> skillIds;
}
