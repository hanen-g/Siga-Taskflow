package com.taskflow.backend.dto.skill;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.taskflow.backend.entity.Skill;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SkillResponse {

    private Long id;
    private String name;
    private String category;
    /** ISO 8601; only populated for detailed admin payloads. */
    private Instant createdAt;
    /** User + project reference rows referencing this skill. */
    private Long usageCount;
    private Boolean archived;

    /** For pickers lists and embedding in other DTOs. */
    public static SkillResponse fromEntity(Skill skill) {
        return fromEntity(skill, null, null);
    }

    /** Optional extras for admin payloads (non-null activates JSON fields). */
    public static SkillResponse fromEntity(Skill skill, Instant createdOverride, Long usageCount) {
        if (skill == null) {
            return null;
        }
        SkillResponse r = new SkillResponse();
        r.setId(skill.getId());
        r.setName(skill.getName());
        r.setCategory(skill.getCategory());
        if (createdOverride != null) {
            r.setCreatedAt(createdOverride);
        } else if (skill.getCreatedAt() != null) {
            r.setCreatedAt(skill.getCreatedAt());
        }
        if (usageCount != null) {
            r.setUsageCount(usageCount);
        }
        return r;
    }

    public static SkillResponse adminTableRow(
            Long id,
            String name,
            String category,
            Instant createdAt,
            long usageCount
    ) {
        SkillResponse r = new SkillResponse();
        r.setId(id);
        r.setName(name);
        r.setCategory(category);
        r.setCreatedAt(createdAt);
        r.setUsageCount(usageCount);
        r.setArchived(false);
        return r;
    }
}
