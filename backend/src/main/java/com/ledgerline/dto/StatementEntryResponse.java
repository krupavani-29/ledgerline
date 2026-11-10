package com.ledgerline.dto;

import com.ledgerline.model.TransactionType;

import java.time.Instant;

public record StatementEntryResponse(
        Long id,
        Long transactionId,
        String referenceId,
        TransactionType transactionType,
        Long amount,
        Long runningBalance,
        String description,
        Instant createdAt
) {}

