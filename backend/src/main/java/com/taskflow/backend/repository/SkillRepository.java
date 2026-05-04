package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigInteger;
import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    Optional<Skill> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndArchivedFalse(String name);

    boolean existsByNameIgnoreCaseAndArchivedFalseAndIdNot(String name, Long id);

    /**
     * Native COUNT avoids JPQL quirks; use {@link BigInteger} because JDBC/MySQL drivers
     * return COUNT(*) as BigInteger and mapping to {@code long} causes 500s.
     */
    @Query(value = "SELECT COUNT(*) FROM user_skills WHERE skill_id = :skillId", nativeQuery = true)
    BigInteger countUserLinksForSkill(@Param("skillId") long skillId);

    @Query(value = "SELECT COUNT(*) FROM project_required_skills WHERE skill_id = :skillId", nativeQuery = true)
    BigInteger countProjectLinksForSkill(@Param("skillId") long skillId);
}
