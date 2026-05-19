package com.taskflow.backend.dto.skill;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.taskflow.backend.entity.Skill;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SkillResponse {

    private Long id;
    private String name;
    private String description;
    /** User + project reference rows referencing this skill. */
    private Long usageCount;
    private Boolean archived;

    /** For pickers lists and embedding in other DTOs. */
    public static SkillResponse fromEntity(Skill skill) {
        return fromEntity(skill, null);
    }

    /** Optional usage total for admin payloads (non-null activates JSON field). */
    public static SkillResponse fromEntity(Skill skill, Long usageCount) {
        if (skill == null) {
            return null;
        }
        SkillResponse r = new SkillResponse();
        r.setId(skill.getId());
        r.setName(skill.getName());
        r.setDescription(skill.getDescription());
        if (usageCount != null) {
            r.setUsageCount(usageCount);
        }
        return r;
    }

    public static SkillResponse adminTableRow(
            Long id,
            String name,
            String description,
            long usageCount
    ) {
        SkillResponse r = new SkillResponse();
        r.setId(id);
        r.setName(name);
        r.setDescription(description);
        r.setUsageCount(usageCount);
        r.setArchived(false);
        return r;
    }
}
