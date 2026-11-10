package com.ledgerline.dto;

import java.time.Instant;

public record AuditLogResponse(
        Long id,
        Long sequenceNum,
        Instant timestamp,
        String actorUsername,
        String actorRole,
        String action,
        String targetResource,
        String result,
        String ipAddress,
        String details,
        String previousHash,
        String entryHash
) {}

