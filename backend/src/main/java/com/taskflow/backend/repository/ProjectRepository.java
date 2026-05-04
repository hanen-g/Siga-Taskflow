package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByManager(User manager);

    List<Project> findByManagerAndArchived(User manager, boolean archived);

    List<Project> findByMembersContainingAndArchived(User member, boolean archived);

    List<Project> findByArchived(boolean archived);

    /**
     * Loads project with tasks for detail views.
     * Do not fetch {@code requiredSkills} in the same graph as {@code tasks}: both are collections on
     * Project and Hibernate can fail or skip fetches (“multiple bags”). Skills load lazily in the same
     * transactional service method before mapping to {@code ProjectResponse}.
     */
    @EntityGraph(attributePaths = { "manager", "tasks", "tasks.collaborators" })
    @Query("SELECT p FROM Project p WHERE p.id = :id")
    Optional<Project> findDetailedById(@Param("id") Long id);
}
