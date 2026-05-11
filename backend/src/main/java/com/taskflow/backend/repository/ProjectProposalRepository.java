package com.taskflow.backend.repository;

import com.taskflow.backend.entity.ProjectProposal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectProposalRepository extends JpaRepository<ProjectProposal, Long> {

    @Query("""
            SELECT DISTINCT pp FROM ProjectProposal pp
            JOIN FETCH pp.proposer
            ORDER BY pp.createdAt DESC
            """)
    List<ProjectProposal> findAllWithProposerOrderByCreatedAtDesc();

    @Query("""
            SELECT DISTINCT pp FROM ProjectProposal pp
            JOIN FETCH pp.proposer
            WHERE pp.proposer.id = :proposerId
            ORDER BY pp.createdAt DESC
            """)
    List<ProjectProposal> findByProposerWithProposerOrderByCreatedAtDesc(@Param("proposerId") Long proposerId);

    @Query("""
            SELECT DISTINCT pp FROM ProjectProposal pp
            JOIN FETCH pp.proposer
            WHERE pp.id = :id
            """)
    Optional<ProjectProposal> findByIdWithProposer(@Param("id") Long id);
}
