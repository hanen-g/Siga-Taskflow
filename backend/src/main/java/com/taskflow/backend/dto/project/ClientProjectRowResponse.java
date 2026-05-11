package com.taskflow.backend.dto.project;

import java.time.LocalDate;

/**
 * Minimal project row for admin client profile (name + deadline).
 */
public record ClientProjectRowResponse(Long id, String name, LocalDate deadline) {}
