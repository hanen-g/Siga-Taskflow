package com.taskflow.backend.dto.project;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AssigneeCandidateResponse {

    private String email;
    private String firstName;
    private String lastName;
    private String role;
    /** Tasks assigned to this user in IN_PROGRESS, ON_HOLD, or IN_REVIEW. */
    private long activeTaskCount;
    /** How many of the requested task skills this user's profile covers. */
    private int matchedSkillCount;
}
