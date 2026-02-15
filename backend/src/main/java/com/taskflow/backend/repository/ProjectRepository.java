package com.taskflow.backend.repository;

import com.taskflow.backend.entity.Project;
import com.taskflow.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByManager(User manager);
}
