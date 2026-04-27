package com.taskflow.backend.dto.skill;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class ProjectSkillMatchResponse {
    private List<SkillResponse> requiredSkills;
    private List<UserSkillMatchResponse> matches;
}
