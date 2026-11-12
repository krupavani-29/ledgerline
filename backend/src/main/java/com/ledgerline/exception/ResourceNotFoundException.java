package com.ledgerline.exception;

import org.springframework.lang.NonNull;

/** Thrown when a requested account, user, or resource does not exist. Returns HTTP 404. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(@NonNull String message) {
        super(message);
    }
}
