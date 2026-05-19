package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Notification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @EntityGraph(attributePaths = {"actor", "task", "project", "proposal", "message"})
    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    List<Notification> findByRecipientIdAndProjectIdAndMessageIsNotNull(Long recipientId, Long projectId);

    void deleteByRecipientId(Long recipientId);
}
