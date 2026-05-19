package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Message;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @EntityGraph(attributePaths = {"sender", "project"})
    List<Message> findByProjectIdOrderByCreatedAtAsc(Long projectId);

    @Query("""
            SELECT COUNT(m) FROM Message m
            WHERE m.project.id = :projectId
              AND m.read = false
              AND m.sender.id <> :recipientId
            """)
    long countUnreadForRecipient(@Param("projectId") Long projectId, @Param("recipientId") Long recipientId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Message m SET m.read = true
            WHERE m.project.id = :projectId
              AND m.read = false
              AND m.sender.id <> :recipientId
            """)
    int markAllAsReadForRecipient(@Param("projectId") Long projectId, @Param("recipientId") Long recipientId);
}
