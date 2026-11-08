package com.ledgerline.dto;

import java.util.UUID;

// AGENTS.md Rule 10: Uniform JSON errors {code, message, traceId}. Never leak stack traces.
public record ApiError(
    String code,
    String message,
    String traceId
) {
    public static ApiError of(String code, String message) {
        return new ApiError(code, message, UUID.randomUUID().toString());
    }
}

