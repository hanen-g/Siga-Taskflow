package com.taskflow.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum ChatIntent {
    FILTER,
    QUESTION,
    ANALYSIS,
    UNKNOWN;

    @JsonCreator
    public static ChatIntent from(String value) {
        if (value == null || value.isBlank()) {
            return UNKNOWN;
        }
        try {
            return ChatIntent.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return UNKNOWN;
        }
    }
}
