package com.taskflow.backend.repository;

import com.taskflow.backend.entity.User;
import com.taskflow.backend.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    @Query("""
            SELECT u FROM User u
            WHERE u.role = :role
              AND (u.isActive = true OR u.isActive IS NULL)
              AND LOWER(u.email) LIKE LOWER(CONCAT('%', :email, '%'))
            ORDER BY u.email ASC
            """)
    List<User> findTop10ActiveByRoleAndEmail(@Param("role") UserRole role, @Param("email") String email);

    @Query("""
            SELECT u FROM User u
            WHERE u.role = :role AND (u.isActive = true OR u.isActive IS NULL)
            """)
    List<User> findByRoleAndActiveIncludingNull(@Param("role") UserRole role);

    @Query("""
            SELECT u FROM User u
            WHERE u.isActive = true OR u.isActive IS NULL
            """)
    List<User> findActiveIncludingNull();

    List<User> findByRoleAndIsActive(UserRole role, boolean isActive);
    List<User> findByIsActive(boolean isActive);
}
