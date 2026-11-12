package com.ledgerline.dto;

import com.ledgerline.model.TransactionType;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * Receipt returned to the client after a successful deposit, withdrawal, or transfer.
 * Also stored as JSON in the idempotency key record for replay responses.
 *
 * @param transactionId   surrogate ID of the transaction record
 * @param referenceId     externally visible reference (e.g. "tx-{UUID}")
 * @param transactionType DEPOSIT, WITHDRAWAL, or TRANSFER
 * @param amount          amount in paise that was moved
 * @param sourceAccountId FK of the debited account; null for deposits
 * @param targetAccountId FK of the credited account; null for withdrawals
 * @param description     free-text narrative
 * @param createdAt       when the transaction was executed
 */
public record TransactionReceipt(
        @Nullable Long transactionId,
        @Nullable String referenceId,
        @NonNull TransactionType transactionType,
        @NonNull Long amount,
        @Nullable Long sourceAccountId,
        @Nullable Long targetAccountId,
        @Nullable String description,
        @NonNull Instant createdAt
) {}
