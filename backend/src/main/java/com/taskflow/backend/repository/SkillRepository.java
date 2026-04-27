package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    Optional<Skill> findByNameIgnoreCase(String name);

    java.util.List<Skill> findAllByOrderByNameAsc();
}
