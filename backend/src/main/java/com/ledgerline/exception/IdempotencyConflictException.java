package com.ledgerline.exception;

import org.springframework.lang.NonNull;

/**
 * Thrown when an idempotency key is reused with a different request payload (HTTP 422),
 * or when there is a concurrent processing conflict on the same key.
 */
public class IdempotencyConflictException extends RuntimeException {
    public IdempotencyConflictException(@NonNull String message) {
        super(message);
    }
}
