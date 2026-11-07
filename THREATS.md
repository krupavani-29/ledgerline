# THREATS.md — LedgerLine Threat Model & Security Assurance

This document defines the comprehensive threat model for **LedgerLine** based on the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege), the defense mechanisms engineered into the system, and the automated tests proving their effectiveness.

---

## Threat Matrix & Automated Verification

| Threat ID | Category | Threat Scenario | Impact | Mitigation Mechanism | Verification Test | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **THREAT-01** | **Tampering / Race Condition** | **Concurrent Double-Spending**: Multiple simultaneous withdrawal/transfer requests against the same account before balance updates. | Account overdraft, balance corruption, unauthorized cash drain. | Pessimistic account locking with deadlock prevention (`Store.withLock`) + ACID transactional state rollback on invariant violation. | `backend/tests/concurrency/raceCondition.test.js` *(Double-Spending Race: 15 concurrent withdrawals)* | **PASSED (1 win, 14 blocked)** |
| **THREAT-02** | **Repudiation / Tampering** | **Network Replay / Duplicate Execution**: Client retries after network timeout, resulting in multiple deductions for the same payment. | Duplicate charging of customer, financial loss. | Strict `Idempotency-Key` engine storing request hash and cached responses; replayed requests return original receipt without re-execution. | `backend/tests/security/idempotency.test.js` *(identical request returns cached response)* | **PASSED (1 debit, 0 duplicates)** |
| **THREAT-03** | **Spoofing / Tampering** | **Idempotency Key Hijacking**: Reusing a completed idempotency key with different payloads (e.g. changing amount or recipient). | Transaction forgery or payload confusion. | Canonical SHA-256 hash verification of `endpoint + request body`. Mismatches reject immediately with HTTP `409 Conflict`. | `backend/tests/security/idempotency.test.js` *(rejects reuse with different payload)* | **PASSED (409 Conflict)** |
| **THREAT-04** | **Elevation of Privilege / Info Disclosure** | **Broken Object-Level Authorization (IDOR/BOLA)**: User A requests statements or transfers money out of User B's account. | Unauthorized funds transfer, private financial data leak. | Strict server-side ownership verification (`account.userId === req.user.id`). Rejections log `SECURITY_IDOR_BLOCKED` to audit log. | `backend/tests/security/auth-and-idor.test.js` *(Anti-IDOR tests for statement & transfer)* | **PASSED (403 Forbidden + Audit Alert)** |
| **THREAT-05** | **Elevation of Privilege** | **Horizontal & Vertical Role Escalation**: Account Holder attempts Admin/Auditor endpoints, or Auditor attempts to move money. | Compromised administration, unmonitored compliance. | Granular RBAC middleware (`requireRole`). Auditors are strictly read-only and barred from mutating balances. | `backend/tests/security/auth-and-idor.test.js` *(RBAC tests)* | **PASSED (403 Forbidden)** |
| **THREAT-06** | **Tampering** | **Negative Balances & Integer Underflow**: Submitting negative numbers, zero amounts, strings, or numbers exceeding available balance. | Artificially generated credit, NaN corruption, floating-point penny shaving. | Multi-layer balance defense: integer cent representation (`parseDollarsToCents`), input validation, and post-transaction invariant checks. | `backend/tests/security/auth-and-idor.test.js` & `backend/tests/unit/ledger.test.js` | **PASSED (400 Bad Request / Invariant check)** |
| **THREAT-07** | **Repudiation** | **Audit Trail Tampering**: Rogue insider or compromised process alters, truncates, or deletes historical transaction records. | Inability to prove transaction history in court or compliance audits. | Append-only cryptographic hash chaining (SHA-256 linked blocks). Verification API verifies sequence and link continuity. | `backend/tests/unit/audit.test.js` *(tampering & record deletion detection)* | **PASSED (Tampering flagged at exact sequence)** |
| **THREAT-08** | **Data Integrity** | **Double-Entry Asymmetry (Unbalanced Books)**: Transaction writes debit without credit or amounts do not balance. | Phantom money creation, ledger discrepancy. | Core double-entry engine enforces $\sum \text{Debits} \equiv \sum \text{Credits}$ for every journal entry. Automated reconciliation audits total system conservation. | `backend/tests/unit/ledger.test.js` *(rejects unbalanced journal entries)* | **PASSED (Invariant Failure if debits != credits)** |
| **THREAT-09** | **Tampering** | **Frozen Account Exploitation**: Withdrawing or transferring funds from an account marked as `FROZEN` by administrators. | Evading fraud hold or regulatory freeze. | Account status check at transaction boundary rejects non-`ACTIVE` accounts before locking funds. | `backend/tests/security/auth-and-idor.test.js` *(Frozen Account test)* | **PASSED (400 Bad Request)** |
| **THREAT-10** | **Denial of Service** | **Concurrency Deadlocks**: Two users simultaneously transferring funds to each other creating circular lock waits. | Worker thread starvation, system lockup. | Lexicographical sorting of account IDs prior to acquiring locks ensures consistent acquisition order across all threads. | `backend/tests/concurrency/raceCondition.test.js` *(Deadlock-Free Bidirectional Transfers)* | **PASSED (16 parallel transfers in 164ms)** |

---

## Detailed Threat Scenarios & Mitigations

### 1. Concurrent Double-Spending (Race Condition)
- **Attack Scenario**: Attacker Alice has $100 in Account A. She initiates 15 simultaneous parallel HTTP POST requests to `/api/transactions/withdraw` with unique idempotency keys, attempting to exploit race conditions between the balance read and write operations.
- **Defense in LedgerLine**:
  1. The transaction service acquires an exclusive lock via `store.withLock([accountId, systemReserveId])`.
  2. Inside the lock, an ACID transaction reads the current balance.
  3. The first request finds $100 balance, writes the debit, and reduces balance to $0.00.
  4. The next 14 requests acquire the lock sequentially, read balance $0.00, and immediately reject with `400 Insufficient funds`.
  5. Tested and verified in `backend/tests/concurrency/raceCondition.test.js`.

### 2. Broken Object-Level Authorization (IDOR)
- **Attack Scenario**: Attacker Alice sends a POST to `/api/transactions/transfer` specifying `sourceAccountId` belonging to Bob (`LL-ACC-200001`), attempting to drain Bob's funds to her own account.
- **Defense in LedgerLine**:
  1. `TransactionService.transfer()` checks `sourceAccount.userId === req.user.id`.
  2. Rejection triggers an immediate HTTP `403 Forbidden`.
  3. A high-priority security event `SECURITY_IDOR_BLOCKED` is permanently written into the cryptographic audit trail, recording Alice's user ID, IP address, user-agent, and the target account.
  4. Tested and verified in `backend/tests/security/auth-and-idor.test.js`.

### 3. Cryptographic Audit Log Immutability
- **Attack Scenario**: An attacker with database write access modifies an audit log record to hide an unauthorized transfer or changes an amount.
- **Defense in LedgerLine**:
  1. Every audit entry contains `sequenceNum`, `previousHash`, and `entryHash = SHA256(sequenceNum + id + timestamp + actorId + action + details + previousHash)`.
  2. The `AuditService.verifyChain()` algorithm traverses the entire ledger from genesis.
  3. Any modified byte changes the recomputed hash, immediately flagging tampering at that exact sequence number.
  4. Tested and verified in `backend/tests/unit/audit.test.js`.

