package com.ledgerline.model;

import jakarta.persistence.*;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * Represents a financial transaction header record (deposit, withdrawal, or transfer).
 * <p>
 * Each Transaction has exactly two associated {@link LedgerEntry} posting legs whose
 * signed amounts sum to zero — enforcing the double-entry accounting identity.
 * <p>
 * The {@code referenceId} (e.g. "tx-{UUID}") is the externally visible transaction reference
 * returned to the client. It is globally unique and stable for idempotency replay.
 */
@Entity
@Table(name = "transactions")
public class Transaction {

    /** Auto-generated surrogate primary key. Null before first persistence. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    /**
     * Externally visible transaction reference in the format "tx-{UUID}".
     * Returned to clients as the transaction receipt identifier.
     * Globally unique and stable across idempotency replays.
     */
    @NonNull
    @Column(name = "reference_id", nullable = false, unique = true, length = 64)
    private String referenceId = "";

    /** Categorizes the transaction for statement display and reporting. */
    @NonNull
    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 32)
    private TransactionType transactionType = TransactionType.DEPOSIT;

    /** Free-text narrative provided by the initiating user. May be null. */
    @Nullable
    @Column(name = "description", length = 255)
    private String description;

    /** Timestamp when this transaction was created. Immutable after insertion. */
    @NonNull
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** No-arg constructor required by JPA. */
    public Transaction() {
        this.createdAt = Instant.now();
    }

    /**
     * Creates a new transaction header record.
     *
     * @param referenceId     externally visible reference ID (e.g. "tx-{UUID}")
     * @param transactionType DEPOSIT, WITHDRAWAL, or TRANSFER
     * @param description     optional free-text narrative; null is acceptable
     */
    public Transaction(
            @NonNull String referenceId,
            @NonNull TransactionType transactionType,
            @Nullable String description
    ) {
        this.referenceId = referenceId;
        this.transactionType = transactionType;
        this.description = description;
        this.createdAt = Instant.now();
    }

    @Nullable
    public Long getId() { return id; }
    public void setId(@Nullable Long id) { this.id = id; }

    @NonNull
    public String getReferenceId() { return referenceId; }
    public void setReferenceId(@NonNull String referenceId) { this.referenceId = referenceId; }

    @NonNull
    public TransactionType getTransactionType() { return transactionType; }
    public void setTransactionType(@NonNull TransactionType transactionType) { this.transactionType = transactionType; }

    @Nullable
    public String getDescription() { return description; }
    public void setDescription(@Nullable String description) { this.description = description; }

    @NonNull
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(@NonNull Instant createdAt) { this.createdAt = createdAt; }
}
