package com.taskflow.backend.repository;

import com.taskflow.backend.entity.TaskReport;
import com.taskflow.backend.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaskReportRepository extends JpaRepository<TaskReport, Long> {

    @EntityGraph(attributePaths = {
            "task",
            "task.project",
            "task.project.manager",
            "task.collaborators",
            "reporter"
    })
    List<TaskReport> findByTaskProjectManagerAndResolvedFalseOrderByCreatedAtDesc(User manager);

    @EntityGraph(attributePaths = {
            "task",
            "task.project",
            "task.project.manager",
            "task.collaborators",
            "reporter"
    })
    @Query("select tr from TaskReport tr where tr.id = :id")
    Optional<TaskReport> findDetailedById(@Param("id") Long id);
}
