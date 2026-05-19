package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.ProjectStatus;
import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long>, JpaSpecificationExecutor<Project> {

    @EntityGraph(attributePaths = {"manager", "tasks", "members", "requiredSkills"})
    List<Project> findByManager(User manager);

    @EntityGraph(attributePaths = {"manager", "tasks", "members", "requiredSkills"})
    List<Project> findByManagerAndStatus(User manager, ProjectStatus status);

    @EntityGraph(attributePaths = {"manager", "tasks", "members", "requiredSkills"})
    List<Project> findByMembersContainingAndStatusNot(User member, ProjectStatus status);

    @EntityGraph(attributePaths = {"manager", "tasks", "members", "requiredSkills"})
    List<Project> findByStatus(ProjectStatus status);

    @EntityGraph(attributePaths = {"manager", "tasks", "members", "requiredSkills"})
    List<Project> findByStatusNot(ProjectStatus status);

    /**
     * Members of a project filtered by role (used to list current client accounts on a project).
     */
    @Query("SELECT m FROM Project p JOIN p.members m WHERE p.id = :projectId AND m.role = :role")
    List<User> findMembersByProjectIdAndRole(@Param("projectId") Long projectId, @Param("role") UserRole role);

    /**
     * Loads project with tasks for detail views.
     * Do not fetch requiredSkills in the same graph as tasks: both are collections on
     * Project and Hibernate can fail with a multiple-bag fetch.
     */
    @EntityGraph(attributePaths = { "manager", "tasks", "tasks.collaborators", "members" })
    @Query("SELECT p FROM Project p WHERE p.id = :id")
    Optional<Project> findDetailedById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"manager", "tasks", "tasks.collaborators", "members"})
    @Query("select distinct p from Project p where p.manager = :manager")
    List<Project> findDistinctByManagerForReporting(@Param("manager") User manager);

    @EntityGraph(attributePaths = {"manager", "tasks", "tasks.collaborators", "members"})
    @Query("select distinct p from Project p join p.members m where m = :member and p.status <> :archivedStatus")
    List<Project> findDistinctActiveByMemberForReporting(@Param("member") User member, @Param("archivedStatus") ProjectStatus archivedStatus);

    @EntityGraph(attributePaths = {"manager", "tasks", "tasks.collaborators", "members"})
    @Query("select distinct p from Project p")
    List<Project> findAllDistinctForReporting();

    @EntityGraph(attributePaths = {"manager", "tasks", "members", "requiredSkills"})
    @Query("select distinct p from Project p where p.id in :ids")
    List<Project> findDetailedByIdIn(@Param("ids") List<Long> ids);

    @Override
    Page<Project> findAll(Specification<Project> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"manager", "tasks"})
    @Query("select p from Project p order by p.deadline desc nulls last, p.id desc")
    List<Project> findForAiSnapshotOrderByActivity(Pageable pageable);
}
