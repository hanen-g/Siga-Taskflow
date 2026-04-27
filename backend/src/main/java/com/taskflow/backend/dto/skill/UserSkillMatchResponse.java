package com.taskflow.backend.dto.skill;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class UserSkillMatchResponse {

    private Long userId;
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    /** How many of the project's required skills this user has */
    private int matchedCount;
    private int requiredCount;
    private boolean fullMatch;
    private List<SkillResponse> matchedSkills;
}
