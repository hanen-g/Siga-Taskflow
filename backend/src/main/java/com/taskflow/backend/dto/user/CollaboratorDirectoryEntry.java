package com.taskflow.backend.dto.user;

/**
 * Lightweight row for assigning tasks: only id and display-safe fields (no secrets).
 */
public record CollaboratorDirectoryEntry(Long id, String email, String firstName, String lastName) {}
