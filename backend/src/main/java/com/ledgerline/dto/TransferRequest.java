package com.ledgerline.dto;

import jakarta.validation.constraints.NotNull;

// AGENTS.md Rule 1: Amount must be minor units (paise). Client balance or role fields are absent.
public record TransferRequest(
    @NotNull(message = "Source account ID is required")
    Long sourceAccountId,

    @NotNull(message = "Target account ID is required")
    Long targetAccountId,

    @NotNull(message = "Amount is required")
    Long amount,

    String description
) {}

