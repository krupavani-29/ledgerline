-- =============================================================================
-- V2__seed_data.sql: Seed users, accounts, and double-entry initial balances
-- AGENTS.md Rules: 3 (Double-entry sums to 0), 4 (Positive balance), 8 (Roles)
-- =============================================================================

-- 1. Seed Users (Passwords: 'Password@123')
INSERT INTO users (id, username, password_hash, role, full_name, created_at) VALUES
(1, 'admin', '$2a$10$jCmihSpeUZfMY7ZcORLH0.S8yt3fiMYBjzhsWduS6bBZ///emQ2ke', 'ADMIN', 'System Administrator', NOW()),
(2, 'asha', '$2a$10$jCmihSpeUZfMY7ZcORLH0.S8yt3fiMYBjzhsWduS6bBZ///emQ2ke', 'HOLDER', 'Asha Sharma', NOW()),
(3, 'ravi', '$2a$10$jCmihSpeUZfMY7ZcORLH0.S8yt3fiMYBjzhsWduS6bBZ///emQ2ke', 'HOLDER', 'Ravi Patel', NOW()),
(4, 'auditor', '$2a$10$jCmihSpeUZfMY7ZcORLH0.S8yt3fiMYBjzhsWduS6bBZ///emQ2ke', 'AUDITOR', 'Chief Compliance Auditor', NOW());

-- 2. Seed Accounts (ACC-SYSTEM-CASH is system account; Asha & Ravi are holders)
INSERT INTO accounts (id, account_number, user_id, is_system, balance, currency, created_at, updated_at) VALUES
(1, 'ACC-SYSTEM-CASH', NULL, TRUE, -5825000, 'INR', NOW(), NOW()),
(2, 'ACC-1042', 2, FALSE, 4825000, 'INR', NOW(), NOW()),
(3, 'ACC-2087', 3, FALSE, 1000000, 'INR', NOW(), NOW());

-- 3. Initial Double-Entry Deposit Transactions (Rule 3: Sum of legs = 0)
INSERT INTO transactions (id, reference_id, transaction_type, description, created_at) VALUES
(1, 'tx-seed-asha-001', 'DEPOSIT', 'Initial balance deposit for Asha Sharma', NOW()),
(2, 'tx-seed-ravi-002', 'DEPOSIT', 'Initial balance deposit for Ravi Patel', NOW());

INSERT INTO ledger_entries (id, transaction_id, account_id, amount, running_balance, created_at) VALUES
(1, 1, 1, -4825000, -4825000, NOW()),
(2, 1, 2, 4825000, 4825000, NOW()),
(3, 2, 1, -1000000, -5825000, NOW()),
(4, 2, 3, 1000000, 1000000, NOW());

-- 4. Genesis Block in Audit Log
INSERT INTO audit_log (
    id, sequence_num, timestamp, actor_username, actor_role, action, target_resource, result, ip_address, details, previous_hash, entry_hash
) VALUES (
    1, 1, NOW(), 'SYSTEM', 'ADMIN', 'SYSTEM_INITIALIZATION', 'LEDGERLINE_GENESIS', 'ALLOWED', '127.0.0.1', '{"version":"1.0.0"}',
    '0000000000000000000000000000000000000000000000000000000000000000',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
);
