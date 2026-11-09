package com.ledgerline.dto;

import jakarta.validation.constraints.NotNull;

// AGENTS.md Rule 1: Amount must be minor units (paise). Client balance or role fields are absent.
public record WithdrawalRequest(
    @NotNull(message = "Account ID is required")
    Long accountId,

    @NotNull(message = "Amount is required")
    Long amount,

    String description
) {}

