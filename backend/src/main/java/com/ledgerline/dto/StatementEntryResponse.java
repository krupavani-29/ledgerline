package com.ledgerline.dto;

import com.ledgerline.model.TransactionType;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * A single row in a paginated account statement.
 * Returned as part of {@link AccountStatementResponse}.
 *
 * @param id              ledger entry surrogate ID
 * @param transactionId   FK to the parent transaction
 * @param referenceId     externally visible transaction reference (e.g. "tx-{UUID}")
 * @param transactionType DEPOSIT, WITHDRAWAL, or TRANSFER
 * @param amount          signed amount in paise (positive = credit, negative = debit)
 * @param runningBalance  account balance after this entry was applied
 * @param description     free-text narrative from the original request
 * @param createdAt       when this ledger entry was posted
 */
public record StatementEntryResponse(
        @Nullable Long id,
        @Nullable Long transactionId,
        @Nullable String referenceId,
        @Nullable TransactionType transactionType,
        @NonNull Long amount,
        @NonNull Long runningBalance,
        @Nullable String description,
        @NonNull Instant createdAt
) {}
