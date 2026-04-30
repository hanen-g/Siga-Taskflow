package com.taskflow.backend.repository;

import com.taskflow.backend.entity.TaskReport;
import com.taskflow.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskReportRepository extends JpaRepository<TaskReport, Long> {
    List<TaskReport> findByTaskProjectManagerAndResolvedFalseOrderByCreatedAtDesc(User manager);
}
