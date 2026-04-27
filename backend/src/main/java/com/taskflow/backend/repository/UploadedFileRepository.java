package com.taskflow.backend.repository;

import com.taskflow.backend.entity.UploadedFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UploadedFileRepository extends JpaRepository<UploadedFile, Long> {

    List<UploadedFile> findByProjectIdOrderByUploadedAtDesc(Long projectId);

    List<UploadedFile> findByTaskIdInOrderByUploadedAtDesc(Collection<Long> taskIds);

    Optional<UploadedFile> findByFileUrl(String fileUrl);
}
