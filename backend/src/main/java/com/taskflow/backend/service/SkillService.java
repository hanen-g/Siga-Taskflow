package com.taskflow.backend.service;

import com.taskflow.backend.dto.skill.CreateSkillRequest;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.exception.ConflictException;
import com.taskflow.backend.repository.SkillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SkillService {

    private final SkillRepository skillRepository;

    public SkillService(SkillRepository skillRepository) {
        this.skillRepository = skillRepository;
    }

    @Transactional(readOnly = true)
    public List<SkillResponse> listAll() {
        return skillRepository.findAllByOrderByNameAsc()
                .stream()
                .map(SkillResponse::fromEntity)
                .toList();
    }

    @Transactional
    public SkillResponse create(CreateSkillRequest request) {
        String name = normalizeName(request.getName());
        if (name.isEmpty()) {
            throw new com.taskflow.backend.exception.BadRequestException("Skill name is required");
        }
        skillRepository.findByNameIgnoreCase(name).ifPresent(s -> {
            throw new ConflictException("A skill with this name already exists");
        });
        Skill skill = new Skill();
        skill.setName(name);
        return SkillResponse.fromEntity(skillRepository.save(skill));
    }

    @Transactional
    public void deleteById(Long id) {
        if (!skillRepository.existsById(id)) {
            throw new com.taskflow.backend.exception.ResourceNotFoundException("Skill", id);
        }
        skillRepository.deleteById(id);
    }

    public static String normalizeName(String name) {
        if (name == null) {
            return "";
        }
        return name.trim();
    }
}
