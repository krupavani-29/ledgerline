package com.ledgerline.dto;

import jakarta.validation.constraints.NotBlank;
import org.springframework.lang.NonNull;

/**
 * Request body for POST /api/auth/login.
 * Per AGENTS.md Rule 7: only credentials are accepted; role/balance fields are ignored.
 *
 * @param username the account holder's login name
 * @param password plaintext password to verify against the BCrypt hash
 */
public record LoginRequest(
        @NotBlank(message = "Username is required")
        @NonNull String username,

        @NotBlank(message = "Password is required")
        @NonNull String password
) {}
