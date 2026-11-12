package com.ledgerline.dto;

import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.util.UUID;

/**
 * Uniform JSON error body returned for all API errors.
 * Per AGENTS.md Rule 10: no stack traces, SQL errors, or internal paths are ever exposed.
 *
 * @param code     machine-readable error code (e.g. "NOT_FOUND", "FORBIDDEN")
 * @param message  human-readable error description
 * @param traceId  unique trace ID for correlating with server logs
 */
public record ApiError(
        @NonNull String code,
        @NonNull String message,
        @NonNull String traceId
) {
    /**
     * Factory method that auto-generates a random trace ID.
     *
     * @param code    machine-readable error code
     * @param message human-readable description
     * @return a new {@link ApiError} with a random UUID trace ID
     */
    @NonNull
    public static ApiError of(@NonNull String code, @NonNull String message) {
        return new ApiError(code, message, UUID.randomUUID().toString());
    }
}
