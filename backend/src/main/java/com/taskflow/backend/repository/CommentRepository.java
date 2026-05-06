package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Comment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByTaskIdOrderByCreatedAtAsc(Long taskId);

    @Modifying
    void deleteByTaskId(Long taskId);

    List<Comment> findByTaskIdIn(Collection<Long> taskIds);

    @Query("""
            SELECT c.task.id, MAX(c.createdAt)
            FROM Comment c
            WHERE c.task.id IN :taskIds
            GROUP BY c.task.id
            """)
    List<Object[]> findMaxCreatedAtByTaskIdIn(@Param("taskIds") Collection<Long> taskIds);

    @Query("""
            SELECT c.task.id, MIN(c.createdAt)
            FROM Comment c
            WHERE c.task.id IN :taskIds
            GROUP BY c.task.id
            """)
    List<Object[]> findMinCreatedAtByTaskIdIn(@Param("taskIds") Collection<Long> taskIds);

    @Query("""
            SELECT COUNT(DISTINCT t.id)
            FROM Comment cm
            JOIN cm.task t
            JOIN t.collaborators col
            WHERE col.id = :collaboratorId
              AND t.project.manager.id = cm.user.id
              AND (
                LOWER(cm.content) LIKE '%reject%'
                OR LOWER(cm.content) LIKE '%rework%'
                OR LOWER(cm.content) LIKE '%revise%'
                OR LOWER(cm.content) LIKE '%returned%'
                OR LOWER(cm.content) LIKE '%changes requested%'
                OR LOWER(cm.content) LIKE '%sent back%'
              )
            """)
    long countTasksWithPmRevisionSignalForCollaborator(@Param("collaboratorId") Long collaboratorId);

    @Query("""
            SELECT COUNT(DISTINCT t.id)
            FROM Comment cm
            JOIN cm.task t
            JOIN t.collaborators col
            WHERE col.id = :collaboratorId
              AND t.project.id IN :projectIds
              AND t.project.manager.id = cm.user.id
              AND (
                LOWER(cm.content) LIKE '%reject%'
                OR LOWER(cm.content) LIKE '%rework%'
                OR LOWER(cm.content) LIKE '%revise%'
                OR LOWER(cm.content) LIKE '%returned%'
                OR LOWER(cm.content) LIKE '%changes requested%'
                OR LOWER(cm.content) LIKE '%sent back%'
              )
            """)
    long countTasksWithPmRevisionSignalForCollaboratorInProjects(
            @Param("collaboratorId") Long collaboratorId,
            @Param("projectIds") Collection<Long> projectIds);

    @Query("""
            SELECT DISTINCT c FROM Comment c
            JOIN FETCH c.task t
            JOIN FETCH t.project p
            JOIN FETCH c.user u
            JOIN p.members m
            WHERE m.id = :clientId AND p.archived = false
            ORDER BY c.createdAt DESC
            """)
    List<Comment> findRecentForClientPortfolio(@Param("clientId") Long clientId, Pageable pageable);
}
