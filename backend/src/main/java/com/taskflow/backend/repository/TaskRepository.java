package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {
    @EntityGraph(attributePaths = {"project", "skills"})
    List<Task> findByProjectId(Long projectId);

    @EntityGraph(attributePaths = {"project", "project.manager", "collaborators", "skills"})
    List<Task> findByCollaboratorsContaining(User user);

    @EntityGraph(attributePaths = {"project", "project.manager", "collaborators", "skills"})
    List<Task> findByProjectManager(User manager);

    /** Admin-wide list — fetch project once so calendar / APIs always have projectId + name without extra queries */
    @EntityGraph(attributePaths = {"project", "project.manager", "collaborators", "skills"})
    @Query("select t from Task t")
    List<Task> findAllFetchingProject();

    @Query("select count(t) from Task t join t.collaborators c where c.id = :userId and t.status in :statuses")
    long countByCollaboratorIdAndStatusIn(@Param("userId") Long userId, @Param("statuses") Collection<TaskStatus> statuses);
}
