package com.taskflow.backend.repository;

import com.taskflow.backend.entity.ProjectProposal;
import com.taskflow.backend.entity.ProjectProposalStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectProposalRepository extends JpaRepository<ProjectProposal, Long> {

    /** Admin inbox: awaiting decision (legacy rows may have status null). */
    @Query("""
            SELECT DISTINCT pp FROM ProjectProposal pp
            JOIN FETCH pp.proposer
            WHERE pp.status IS NULL OR pp.status = :pending
            ORDER BY pp.createdAt DESC
            """)
    List<ProjectProposal> findPendingWithProposerOrderByCreatedAtDesc(@Param("pending") ProjectProposalStatus pending);

    @Query("""
            SELECT DISTINCT pp FROM ProjectProposal pp
            JOIN FETCH pp.proposer
            LEFT JOIN FETCH pp.reviewedBy
            WHERE pp.proposer.id = :proposerId
            ORDER BY pp.createdAt DESC
            """)
    List<ProjectProposal> findMyProposalsWithReviewer(@Param("proposerId") Long proposerId);

    @Query("""
            SELECT DISTINCT pp FROM ProjectProposal pp
            JOIN FETCH pp.proposer
            WHERE pp.id = :id
            """)
    Optional<ProjectProposal> findByIdWithProposer(@Param("id") Long id);
}
