package com.ledgerline.model;

import jakarta.persistence.*;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * A single double-entry posting leg in the ledger.
 * <p>
 * Every financial transaction (deposit, withdrawal, transfer) produces exactly two
 * LedgerEntry rows whose amounts sum to 0 — enforcing the double-entry accounting identity.
 * <p>
 * Per AGENTS.md Rule 1: amounts are stored as BIGINT minor units (paise).
 * Positive = credit (increase), negative = debit (decrease).
 * <p>
 * Per AGENTS.md Rule 9: this table is append-only. UPDATE and DELETE are blocked by
 * PostgreSQL triggers in production and by H2 triggers in test environments.
 */
@Entity
@Table(name = "ledger_entries")
public class LedgerEntry {

    /** Auto-generated surrogate primary key. Null before first persistence. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    /** FK to transactions.id — the financial transaction this leg belongs to. */
    @NonNull
    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    /** FK to accounts.id — the account affected by this posting leg. */
    @NonNull
    @Column(name = "account_id", nullable = false)
    private Long accountId;

    /**
     * The signed amount of this posting leg in paise (minor units).
     * Positive = credit/increase, negative = debit/decrease.
     * For any transaction T: sum(all legs for T) == 0 invariant.
     */
    @NonNull
    @Column(name = "amount", nullable = false)
    private Long amount;

    /**
     * Cumulative running balance of the account after this entry is applied.
     * Used to reconstruct account statements without full table scans.
     */
    @NonNull
    @Column(name = "running_balance", nullable = false)
    private Long runningBalance;

    /** Timestamp when this entry was created. Immutable after insertion. */
    @NonNull
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** No-arg constructor required by JPA. */
    public LedgerEntry() {
        this.transactionId = 0L;
        this.accountId = 0L;
        this.amount = 0L;
        this.runningBalance = 0L;
        this.createdAt = Instant.now();
    }

    /**
     * Creates a new ledger posting leg.
     *
     * @param transactionId FK to the parent transaction
     * @param accountId     FK to the account affected
     * @param amount        signed paise amount (positive = credit, negative = debit)
     * @param runningBalance account balance after applying this entry
     */
    public LedgerEntry(
            @NonNull Long transactionId,
            @NonNull Long accountId,
            @NonNull Long amount,
            @NonNull Long runningBalance
    ) {
        this.transactionId = transactionId;
        this.accountId = accountId;
        this.amount = amount;
        this.runningBalance = runningBalance;
        this.createdAt = Instant.now();
    }

    @Nullable
    public Long getId() { return id; }
    public void setId(@Nullable Long id) { this.id = id; }

    @NonNull
    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(@NonNull Long transactionId) { this.transactionId = transactionId; }

    @NonNull
    public Long getAccountId() { return accountId; }
    public void setAccountId(@NonNull Long accountId) { this.accountId = accountId; }

    @NonNull
    public Long getAmount() { return amount; }
    public void setAmount(@NonNull Long amount) { this.amount = amount; }

    @NonNull
    public Long getRunningBalance() { return runningBalance; }
    public void setRunningBalance(@NonNull Long runningBalance) { this.runningBalance = runningBalance; }

    @NonNull
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(@NonNull Instant createdAt) { this.createdAt = createdAt; }
}
