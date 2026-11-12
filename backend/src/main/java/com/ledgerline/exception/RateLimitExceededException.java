package com.ledgerline.exception;

import org.springframework.lang.NonNull;

/** Thrown when a client exceeds the sliding-window rate limit. Returns HTTP 429. */
public class RateLimitExceededException extends RuntimeException {
    public RateLimitExceededException(@NonNull String message) {
        super(message);
    }
}
