package com.ledgerline.dto;

import com.ledgerline.model.TransactionType;
import java.time.Instant;

public record TransactionReceipt(
    Long transactionId,
    String referenceId,
    TransactionType transactionType,
    Long amount,
    Long sourceAccountId,
    Long targetAccountId,
    String description,
    Instant createdAt
) {}

