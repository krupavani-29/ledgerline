package com.ledgerline.exception;

import org.springframework.lang.NonNull;

/** Thrown when a withdrawal or transfer would overdraft the account. Returns HTTP 400. */
public class InsufficientFundsException extends RuntimeException {
    public InsufficientFundsException(@NonNull String message) {
        super(message);
    }
}
