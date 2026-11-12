package com.ledgerline.dto;

import jakarta.validation.constraints.NotNull;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * Request body for POST /api/transfers.
 * Per AGENTS.md Rule 1: amounts are always minor units (paise). No balance/role fields accepted.
 * Self-transfers (sourceAccountId == targetAccountId) are rejected by TransactionService.
 *
 * @param sourceAccountId the account to debit (must be owned by the authenticated user)
 * @param targetAccountId the account to credit (may belong to any user)
 * @param amount          amount in paise to transfer; must be positive and ≤ 100,000,000
 * @param description     optional narrative description for the statement
 */
public record TransferRequest(
        @NotNull(message = "Source account ID is required")
        @NonNull Long sourceAccountId,

        @NotNull(message = "Target account ID is required")
        @NonNull Long targetAccountId,

        @NotNull(message = "Amount is required")
        @NonNull Long amount,

        @Nullable String description
) {}
