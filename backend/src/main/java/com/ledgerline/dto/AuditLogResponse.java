package com.ledgerline.dto;

import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * A single audit log entry as returned by GET /api/audit.
 * All fields mirror the {@link com.ledgerline.model.AuditLogEntry} entity.
 * The {@code entryHash} and {@code previousHash} enable client-side chain verification.
 */
public record AuditLogResponse(
        @Nullable Long id,
        @NonNull Long sequenceNum,
        @NonNull Instant timestamp,
        @NonNull String actorUsername,
        @NonNull String actorRole,
        @NonNull String action,
        @NonNull String targetResource,
        @NonNull String result,
        @NonNull String ipAddress,
        @Nullable String details,
        @NonNull String previousHash,
        @NonNull String entryHash
) {}
