package com.ledgerline.dto;

import jakarta.validation.constraints.NotNull;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * Request body for POST /api/deposits.
 * Per AGENTS.md Rule 1: amounts are always minor units (paise). No balance/role fields accepted.
 *
 * @param accountId   the account to credit (must be owned by the authenticated user)
 * @param amount      amount in paise to deposit; must be positive and ≤ 100,000,000
 * @param description optional narrative description for the statement
 */
public record DepositRequest(
        @NotNull(message = "Account ID is required")
        @NonNull Long accountId,

        @NotNull(message = "Amount is required")
        @NonNull Long amount,

        @Nullable String description
) {}
