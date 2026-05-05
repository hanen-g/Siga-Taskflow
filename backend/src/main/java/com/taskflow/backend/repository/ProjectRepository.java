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
     * Do not fetch requiredSkills in the same graph as tasks: both are collections on
     * Project and Hibernate can fail with a multiple-bag fetch.
     */
    @EntityGraph(attributePaths = { "manager", "tasks", "tasks.collaborators" })
    @Query("SELECT p FROM Project p WHERE p.id = :id")
    Optional<Project> findDetailedById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"manager", "tasks", "tasks.collaborators", "members"})
    @Query("select distinct p from Project p where p.manager = :manager")
    List<Project> findDistinctByManagerForReporting(@Param("manager") User manager);

    @EntityGraph(attributePaths = {"manager", "tasks", "tasks.collaborators", "members"})
    @Query("select distinct p from Project p join p.members m where m = :member and p.archived = false")
    List<Project> findDistinctActiveByMemberForReporting(@Param("member") User member);

    @EntityGraph(attributePaths = {"manager", "tasks", "tasks.collaborators", "members"})
    @Query("select distinct p from Project p")
    List<Project> findAllDistinctForReporting();
}
