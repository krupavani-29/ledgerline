package com.ledgerline.exception;

import org.springframework.lang.NonNull;

/** Thrown for invalid transaction parameters (bad amount, self-transfer, missing key). Returns HTTP 400. */
public class InvalidTransactionException extends RuntimeException {
    public InvalidTransactionException(@NonNull String message) {
        super(message);
    }
}
