package com.ledgerline.model;

import jakarta.persistence.*;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

import java.time.Instant;

/**
 * Represents a customer or system account in the double-entry ledger system.
 * <p>
 * Balance is stored exclusively as BIGINT minor units (paise) per AGENTS.md Rule 1.
 * Initial balance is always 0; money enters only through double-entry ledger postings.
 */
@Entity
@Table(name = "accounts")
public class Account {

    /** Auto-generated surrogate primary key. Null before first persistence. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Nullable
    private Long id;

    /** Human-readable account identifier (e.g. ACC-1234). Globally unique. */
    @NonNull
    @Column(name = "account_number", nullable = false, unique = true, length = 32)
    private String accountNumber = "";

    /** FK to users.id. Null only for the system cash settlement account (is_system = true). */
    @Nullable
    @Column(name = "user_id")
    private Long userId;

    /** True for the internal SYSTEM_RESERVE account used as the settlement counterparty. */
    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    /**
     * Current account balance in paise (BIGINT minor units).
     * AGENTS.md Rule 1: Never store floating-point monetary values.
     */
    @NonNull
    @Column(nullable = false)
    private Long balance = 0L;

    /** ISO 4217 currency code (e.g. "INR"). Defaults to "INR". */
    @NonNull
    @Column(nullable = false, length = 3)
    private String currency = "INR";

    /** Timestamp when this account was created. Set once at construction, never updated. */
    @NonNull
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    /** Timestamp when this account record was last modified (balance update, etc.). */
    @NonNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    /** No-arg constructor required by JPA. */
    public Account() {}

    /**
     * Creates a new account with all required fields.
     *
     * @param accountNumber unique account identifier string
     * @param userId        FK to the owning user; null for system accounts
     * @param isSystem      whether this is the system settlement account
     * @param balance       initial balance in paise (must be 0 for user accounts per AGENTS.md Rule 7)
     * @param currency      ISO 4217 currency code
     */
    public Account(
            @NonNull String accountNumber,
            @Nullable Long userId,
            boolean isSystem,
            @NonNull Long balance,
            @NonNull String currency
    ) {
        this.accountNumber = accountNumber;
        this.userId = userId;
        this.isSystem = isSystem;
        this.balance = balance;
        this.currency = currency;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @Nullable
    public Long getId() { return id; }
    public void setId(@Nullable Long id) { this.id = id; }

    @NonNull
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(@NonNull String accountNumber) { this.accountNumber = accountNumber; }

    @Nullable
    public Long getUserId() { return userId; }
    public void setUserId(@Nullable Long userId) { this.userId = userId; }

    public boolean isSystem() { return isSystem; }
    public void setSystem(boolean system) { isSystem = system; }

    @NonNull
    public Long getBalance() { return balance; }
    public void setBalance(@NonNull Long balance) { this.balance = balance; }

    @NonNull
    public String getCurrency() { return currency; }
    public void setCurrency(@NonNull String currency) { this.currency = currency; }

    @NonNull
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(@NonNull Instant createdAt) { this.createdAt = createdAt; }

    @NonNull
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(@NonNull Instant updatedAt) { this.updatedAt = updatedAt; }
}
