package com.taskflow.backend.dto.skill;

import com.taskflow.backend.entity.Skill;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SkillResponse {

    private Long id;
    private String name;

    public static SkillResponse fromEntity(Skill skill) {
        if (skill == null) {
            return null;
        }
        return new SkillResponse(skill.getId(), skill.getName());
    }
}
