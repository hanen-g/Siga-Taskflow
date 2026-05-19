package com.taskflow.backend.dto.project;

/**
 * Lightweight client account row for admin selection menus (project ↔ client multi-select).
 */
public record ClientOptionResponse(
        Long id,
        String firstName,
        String lastName,
        String email,
        String company,
        /** Hex #rrggbb for admin UI; null means default. */
        String clientLabelColor
) {}
