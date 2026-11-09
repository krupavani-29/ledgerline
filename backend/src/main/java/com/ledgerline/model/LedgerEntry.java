package com.ledgerline.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "ledger_entries")
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", nullable = false)
    private Long transactionId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    // AGENTS.md Rule 1: BIGINT minor units (paise). Signed: positive = credit/increase, negative = debit/decrease
    @Column(name = "amount", nullable = false)
    private Long amount;

    @Column(name = "running_balance", nullable = false)
    private Long runningBalance;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public LedgerEntry() {
    }

    public LedgerEntry(Long transactionId, Long accountId, Long amount, Long runningBalance) {
        this.transactionId = transactionId;
        this.accountId = accountId;
        this.amount = amount;
        this.runningBalance = runningBalance;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTransactionId() { return transactionId; }
    public void setTransactionId(Long transactionId) { this.transactionId = transactionId; }

    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }

    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }

    public Long getRunningBalance() { return runningBalance; }
    public void setRunningBalance(Long runningBalance) { this.runningBalance = runningBalance; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}

