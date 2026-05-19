package com.taskflow.backend.util;

import java.util.Locale;
import java.util.Set;

/**
 * Allowed client profile label colors (hex). Values are normalized to lowercase {@code #rrggbb}.
 */
public final class ClientLabelColors {

    public static final String DEFAULT = "#3b82f6";

    private static final Set<String> ALLOWED = Set.of(
            "#e11d48",
            "#f472b6",
            "#fb923c",
            "#facc15",
            "#84cc16",
            "#10b981",
            "#0ea5e9",
            "#3b82f6",
            "#8b5cf6",
            "#a78bfa"
    );

    private ClientLabelColors() {
    }

    public static boolean isAllowed(String hex) {
        if (hex == null) {
            return false;
        }
        return ALLOWED.contains(hex.trim().toLowerCase(Locale.ROOT));
    }

    /** Returns a palette color, or {@link #DEFAULT} if null/blank/unknown. */
    public static String normalizeOrDefault(String raw) {
        if (raw == null) {
            return DEFAULT;
        }
        String s = raw.trim().toLowerCase(Locale.ROOT);
        return ALLOWED.contains(s) ? s : DEFAULT;
    }
}
