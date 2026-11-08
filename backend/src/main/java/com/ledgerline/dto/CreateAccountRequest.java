package com.ledgerline.dto;

import jakarta.validation.constraints.NotNull;

// AGENTS.md Rule 7 & Threat 5: Mass assignment defense.
// DTO allows only userId and currency. Any client-supplied 'balance', 'isSystem', or 'role' fields are strictly ignored.
public record CreateAccountRequest(
    @NotNull(message = "User ID is required")
    Long userId,
    String currency
) {}

