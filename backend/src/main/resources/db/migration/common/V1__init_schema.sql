-- =============================================================================
-- V1__init_schema.sql: Core schema with check constraints
-- AGENTS.md Rules: 1 (BIGINT paise), 4 (CHECK balance >= 0), 5 (UNIQUE idempotency)
-- =============================================================================

-- 1. Users Table
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'HOLDER', 'AUDITOR')),
    full_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Accounts Table
-- Overdraft is prevented by CHECK (is_system = TRUE OR balance >= 0) as per Rule 4
CREATE TABLE accounts (
    id BIGSERIAL PRIMARY KEY,
    account_number VARCHAR(32) UNIQUE NOT NULL,
    user_id BIGINT REFERENCES users(id),
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    balance BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_positive_balance CHECK (is_system = TRUE OR balance >= 0)
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- 3. Transactions Table (Header for grouping ledger entries)
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    reference_id VARCHAR(64) UNIQUE NOT NULL,
    transaction_type VARCHAR(32) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Ledger Entries Table (Double-entry legs, append-only)
CREATE TABLE ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id),
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    amount BIGINT NOT NULL,
    running_balance BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_entries_tx_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id);

-- 5. Idempotency Keys Table
-- Rule 5: UNIQUE (user_id, idempotency_key) to prevent double charge
CREATE TABLE idempotency_keys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status_code INT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_idempotency UNIQUE (user_id, idempotency_key)
);

CREATE INDEX idx_idempotency_lookup ON idempotency_keys(user_id, idempotency_key);

-- 6. Audit Log Table (Append-only with SHA-256 hash chaining)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    sequence_num BIGINT NOT NULL UNIQUE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actor_username VARCHAR(50) NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_resource VARCHAR(128) NOT NULL,
    result VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    details TEXT,
    previous_hash VARCHAR(64) NOT NULL,
    entry_hash VARCHAR(64) NOT NULL
);

CREATE INDEX idx_audit_sequence ON audit_log(sequence_num);

