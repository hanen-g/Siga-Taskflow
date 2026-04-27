package com.taskflow.backend.service;

import com.taskflow.backend.dto.skill.SkillIdsRequest;
import com.taskflow.backend.dto.skill.SkillResponse;
import com.taskflow.backend.entity.Skill;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import com.taskflow.backend.exception.BadRequestException;
import com.taskflow.backend.repository.SkillRepository;
import com.taskflow.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserSkillService {

    private static final Set<UserRole> ROLES_MAY_SET_SKILLS = Set.of(
            UserRole.PROJECT_MANAGER,
            UserRole.COLLABORATOR,
            UserRole.ADMIN
    );

    private final UserRepository userRepository;
    private final SkillRepository skillRepository;

    public UserSkillService(UserRepository userRepository, SkillRepository skillRepository) {
        this.userRepository = userRepository;
        this.skillRepository = skillRepository;
    }

    @Transactional(readOnly = true)
    public List<SkillResponse> getSkillsForUser(User user) {
        user = userRepository.findById(user.getId()).orElse(user);
        if (user.getSkills() == null) {
            return List.of();
        }
        return user.getSkills()
                .stream()
                .map(SkillResponse::fromEntity)
                .sorted((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
                .toList();
    }

    @Transactional
    public List<SkillResponse> replaceSkillsForUser(User actor, SkillIdsRequest request) {
        if (actor.getRole() == null || !ROLES_MAY_SET_SKILLS.contains(actor.getRole())) {
            throw new com.taskflow.backend.exception.UnauthorizedException("Only project managers, collaborators, and administrators can set skills");
        }
        List<Long> ids = request.getSkillIds() == null ? List.of() : request.getSkillIds();
        var unique = ids.stream().distinct().collect(Collectors.toList());
        User user = userRepository.findById(actor.getId())
                .orElseThrow(() -> new com.taskflow.backend.exception.ResourceNotFoundException("User", actor.getId()));
        if (unique.isEmpty()) {
            user.setSkills(new HashSet<>());
        } else {
            List<Skill> found = skillRepository.findAllById(unique);
            if (found.size() != unique.size()) {
                throw new BadRequestException("One or more skill ids are invalid");
            }
            user.setSkills(new HashSet<>(found));
        }
        userRepository.save(user);
        return getSkillsForUser(user);
    }
}
