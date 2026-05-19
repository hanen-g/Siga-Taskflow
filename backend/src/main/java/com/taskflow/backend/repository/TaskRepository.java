package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Task;
import com.taskflow.backend.entity.TaskStatus;
import com.taskflow.backend.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;

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

    long countByStatus(TaskStatus status);

    @EntityGraph(attributePaths = {"project", "project.manager", "collaborators"})
    @Query("select t from Task t order by t.deadline desc nulls last, t.id desc")
    List<Task> findForAiSnapshotOrderByActivity(Pageable pageable);

    @Query("""
            select c.id, count(t), coalesce(sum(case when t.status = com.taskflow.backend.entity.TaskStatus.DONE then 1 else 0 end), 0)
            from Task t join t.collaborators c
            where c.id in :userIds
            group by c.id
            """)
    List<Object[]> aggregateTaskCountsForCollaborators(@Param("userIds") Set<Long> userIds);

    @Query("select count(t) from Task t where t.status <> com.taskflow.backend.entity.TaskStatus.DONE"
            + " and t.deadline is not null and t.deadline < :now")
    long countOverdueNotDone(@Param("now") LocalDateTime now);
}
