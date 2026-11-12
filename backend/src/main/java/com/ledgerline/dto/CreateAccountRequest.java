package com.ledgerline.dto;

import jakarta.validation.constraints.NotNull;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * Request body for POST /api/accounts (ADMIN only).
 * Per AGENTS.md Rule 7 and Threat 5: mass-assignment defense.
 * Only {@code userId} and {@code currency} are accepted. Any client-supplied
 * {@code balance}, {@code isSystem}, or {@code role} fields are strictly ignored.
 *
 * @param userId   FK to the user who will own the new account
 * @param currency ISO 4217 currency code (e.g. "INR"); defaults to "INR" if null
 */
public record CreateAccountRequest(
        @NotNull(message = "User ID is required")
        @NonNull Long userId,

        @Nullable String currency
) {}
