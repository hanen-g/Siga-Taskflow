package com.taskflow.backend.service;

import com.taskflow.backend.dto.skill.CreateSkillRequest;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.dto.skill.UpdateSkillRequest;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.exception.ConflictException;
import com.taskflow.backend.exception.ResourceNotFoundException;
import com.taskflow.backend.repository.SkillRepository;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class SkillService {

    private final SkillRepository skillRepository;
    private final JdbcTemplate jdbcTemplate;

    public SkillService(SkillRepository skillRepository, JdbcTemplate jdbcTemplate) {
        this.skillRepository = skillRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<SkillResponse> listAll() {
        return skillRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .filter(skill -> !skill.isArchived())
                .map(SkillResponse::fromEntity)
                .toList();
    }

    /** Admin catalog with usage totals: bulk aggregation + sorted full load (robust vs derived queries). */
    @Transactional(readOnly = true)
    public List<SkillResponse> listForAdminTable() {
        Map<Long, Long> usageBySkillId = aggregatedUsageTotalsBySkillId();
        return skillRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .filter(skill -> !skill.isArchived())
                .map(s -> SkillResponse.adminTableRow(
                        s.getId(),
                        s.getName(),
                        s.getCategory(),
                        s.getCreatedAt(),
                        usageBySkillId.getOrDefault(s.getId(), 0L)))
                .toList();
    }

    private Map<Long, Long> aggregatedUsageTotalsBySkillId() {
        Map<Long, Long> totals = new HashMap<>();
        // Use JdbcTemplate (not JPA native List<Object[]>); Hibernate mapping of aggregate rows is brittle on MySQL.
        RowCallbackHandler addRow = rs ->
                totals.merge(rs.getLong("sid"), rs.getLong("cnt"), Long::sum);
        jdbcTemplate.query(
                "SELECT skill_id AS sid, COUNT(*) AS cnt FROM user_skills GROUP BY skill_id",
                addRow);
        jdbcTemplate.query(
                "SELECT skill_id AS sid, COUNT(*) AS cnt FROM project_required_skills GROUP BY skill_id",
                addRow);
        return totals;
    }

    private long totalAssignmentsForSkill(long skillId) {
        return toNonNegativeLong(skillRepository.countUserLinksForSkill(skillId))
                + toNonNegativeLong(skillRepository.countProjectLinksForSkill(skillId));
    }

    private static long toNonNegativeLong(Number n) {
        if (n == null) {
            return 0L;
        }
        long v = n.longValue();
        return v < 0 ? 0 : v;
    }


    @Transactional
    public SkillResponse create(CreateSkillRequest request) {
        if (request == null) {
            throw new BadRequestException("Request body is required");
        }
        String name = normalizeName(request.getName());
        if (name.isEmpty()) {
            throw new BadRequestException("Skill name is required");
        }
        if (name.length() > 200) {
            throw new BadRequestException("Skill name must be at most 200 characters");
        }
        Optional<Skill> byName = skillRepository.findByNameIgnoreCase(name);
        if (byName.isPresent()) {
            Skill existing = byName.get();
            if (!existing.isArchived()) {
                throw new ConflictException("A skill with this name already exists");
            }
            /** Same name as an archived row — reactivate instead of INSERT (avoids unique-key 400 on MySQL). */
            existing.setArchived(false);
            if (request.getCategory() != null) {
                existing.setCategory(normalizeCategory(request.getCategory()));
            }
            Skill saved = skillRepository.save(existing);
            long usage = totalAssignmentsForSkill(saved.getId());
            return SkillResponse.fromEntity(saved, saved.getCreatedAt(), usage);
        }
        Skill skill = new Skill();
        skill.setName(name);
        skill.setCategory(normalizeCategory(request.getCategory()));
        skill.setArchived(false);
        return SkillResponse.fromEntity(skillRepository.save(skill), null, 0L);
    }

    @Transactional
    public SkillResponse update(Long id, UpdateSkillRequest request) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill", id));
        if (skill.isArchived()) {
            throw new BadRequestException("Cannot edit an archived skill.");
        }
        String newName = request.getName() != null ? normalizeName(request.getName()) : skill.getName();
        if (newName.isEmpty()) {
            throw new BadRequestException("Skill name is required");
        }
        if (!newName.equalsIgnoreCase(skill.getName())
                && skillRepository.existsByNameIgnoreCaseAndArchivedFalseAndIdNot(newName, id)) {
            throw new ConflictException("A skill with this name already exists");
        }
        skill.setName(newName);
        if (request.getCategory() != null) {
            skill.setCategory(normalizeCategory(request.getCategory()));
        }
        Skill saved = skillRepository.save(skill);
        long usage = totalAssignmentsForSkill(saved.getId());
        return SkillResponse.fromEntity(saved, saved.getCreatedAt(), usage);
    }

    @Transactional
    public void archiveById(Long id) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill", id));
        if (skill.isArchived()) {
            return;
        }
        skill.setArchived(true);
        skillRepository.save(skill);
    }

    public static void ensureNotArchived(Skill skill) {
        if (skill != null && skill.isArchived()) {
            throw new BadRequestException("Skill \"" + skill.getName() + "\" is archived.");
        }
    }

    public static void ensureNotArchived(List<Skill> skills) {
        if (skills == null) {
            return;
        }
        for (Skill s : skills) {
            ensureNotArchived(s);
        }
    }

    private String normalizeCategory(String category) {
        if (category == null) {
            return null;
        }
        String t = category.trim();
        return t.isEmpty() ? null : t;
    }

    public static String normalizeName(String name) {
        if (name == null) {
            return "";
        }
        return name.trim();
    }
}
