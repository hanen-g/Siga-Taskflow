package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByManager(User manager);

    List<Project> findByManagerAndArchived(User manager, boolean archived);

    List<Project> findByMembersContainingAndArchived(User member, boolean archived);

    List<Project> findByArchived(boolean archived);

    @EntityGraph(attributePaths = { "manager", "tasks", "tasks.collaborators" })
    Optional<Project> findDetailedById(Long id);
}
