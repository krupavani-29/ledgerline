# PROMPTS.md — AI Engineering Directives & Mistake Tracking

This document records the prompts given to AI coding tools during the development of **LedgerLine**, the flawed outputs generated, the root causes identified, and the engineering corrections applied with references to git commits.

---

## Entry 1: Native Addon Compilation Trap on Modern Node Environments
- **Date**: 2026-11-06
- **Prompt**:
  > *"Set up a persistent, high-performance transactional database for the double-entry ledger using better-sqlite3 in Node.js."*
- **What the tool produced**:
  The AI suggested adding `better-sqlite3: ^11.8.1` to `package.json` and running `npm install`.
- **What was wrong with it**:
  `better-sqlite3` relies on native C++ bindings via `node-gyp`. When installing on Node v26.13.0 on Windows, no prebuilt binary existed, and `node-gyp rebuild` failed with exit code 1 (`Error: Could not find any Visual Studio installation to use`). This breaks "stranger-runnable" evaluation, as any evaluator or production environment without Visual Studio C++ build tools would fail to install and boot the project.
- **What I did instead**:
  Removed the native C++ dependency and engineered a pure JavaScript ACID transactional engine (`backend/src/db/store.js`) supporting atomic snapshotting, state rollback on invariant violation, and disk synchronization. The application installs in seconds with zero build tools on Windows, Linux, and macOS.
- **Commit Reference**: [`80184bb`](file:///D:/snovasys/backend/src/db/store.js)

---

## Entry 2: Double-Entry Banking Reserve Model & Conservation Arithmetic
- **Date**: 2026-11-06
- **Prompt**:
  > *"Write the double-entry ledger recording logic for customer deposits, withdrawals, and system reserve."*
- **What the tool produced**:
  The AI produced a ledger where deposits debited the system reserve account with the same direction semantics as customer accounts, and initialized the reserve balance with a hardcoded value not tied to posting legs.
- **What was wrong with it**:
  When running the mathematical conservation check, `ledgerService.verifyConservation()` flagged a discrepancy:
  `Account LL-SYS-000001 balance mismatch: Stored=98100000, CalculatedFromLegs=-1900000`.
  In true banking double-entry accounting:
  - `SYSTEM_RESERVE` is a cash/settlement **Asset** account: **Debit** increases vault cash (+), **Credit** decreases vault cash (-).
  - Customer Checking/Savings accounts are **Liability** accounts: **Credit** increases customer deposit (+), **Debit** decreases customer deposit (-).
- **What I did instead**:
  Refactored `backend/src/modules/ledger/ledgerService.js` to strictly enforce asset vs liability polarity. For deposits: Debit `SYSTEM_RESERVE` (+cash) and Credit `USER_ACCOUNT` (+deposit). All balances start at zero and are 100% derived from balanced posting legs. Result: $\sum \text{Customer Balances} \equiv \text{System Reserve}$, with 0 discrepancy across all accounts.
- **Commit Reference**: [`80184bb`](file:///D:/snovasys/backend/src/modules/ledger/ledgerService.js)

---

## Entry 3: Broken Object-Level Authorization (IDOR) on Fund Transfers
- **Date**: 2026-11-06
- **Prompt**:
  > *"Implement the fund transfer endpoint between accounts and check that the sender account has sufficient funds."*
- **What the tool produced**:
  ```javascript
  const sourceAccount = store.getAccountById(sourceAccountId);
  if (sourceAccount.balance < amount) throw new Error('Insufficient funds');
  // proceed to execute transfer...
  ```
- **What was wrong with it**:
  Critical **Broken Object-Level Authorization (IDOR/BOLA)** vulnerability! The AI verified that the account existed and had money, but completely failed to check whether the authenticated user (`req.user.id`) actually owned `sourceAccount`. Any logged-in user could supply another user's account ID and drain their funds. Additionally, failed attempts were not recorded in any audit trail.
- **What I did instead**:
  Added strict ownership verification in `TransactionService.transfer()`:
  `if (userRole !== config.ROLES.ADMIN && sourceAccount.userId !== userId)`.
  If a user attempts to debit or view an account they do not own, the request is immediately rejected with HTTP `403 Forbidden`, and an immutable security alert `SECURITY_IDOR_BLOCKED` is written to the cryptographic audit trail recording the actor ID, target account ID, IP address, and timestamp.
- **Commit Reference**: [`80184bb`](file:///D:/snovasys/backend/src/modules/transactions/transactionService.js), verified in test commit [`28c36f7`](file:///D:/snovasys/backend/tests/security/auth-and-idor.test.js)

---

## Entry 4: Audit Trail Immutability & Cryptographic Hash-Chaining
- **Date**: 2026-11-06
- **Prompt**:
  > *"Create an audit logging service to track user actions, transfers, and security events."*
- **What the tool produced**:
  A standard append-only array/table storing `{ id, timestamp, actorId, action, details }`.
- **What was wrong with it**:
  A plain database table provides zero non-repudiation or tamper-evidence. Anyone with access to the underlying storage or a compromised service account could silently modify transaction amounts, back-date records, or delete evidence of an unauthorized transfer without detection.
- **What I did instead**:
  Implemented cryptographic SHA-256 hash chaining in `backend/src/modules/audit/auditService.js`. Each entry calculates `entryHash = SHA256(sequenceNum + id + timestamp + actorId + action + details + previousHash)`, linking directly to the genesis block. Added `AuditService.verifyChain()` which recalculates and validates the entire chain from block 1 to head, immediately catching any modified, inserted, or deleted record.
- **Commit Reference**: [`80184bb`](file:///D:/snovasys/backend/src/modules/audit/auditService.js), verified in test commit [`28c36f7`](file:///D:/snovasys/backend/tests/unit/audit.test.js)

---

## Entry 5: Time-of-Check to Time-of-Use (TOCTOU) Race Conditions & Concurrency Deadlocks
- **Date**: 2026-11-06
- **Prompt**:
  > *"Write an async handler for withdrawals that checks the balance and updates the database."*
- **What the tool produced**:
  Standard asynchronous code that read the account balance, performed an `await`, and then saved the subtracted balance.
- **What was wrong with it**:
  Classic Time-of-Check to Time-of-Use (TOCTOU) concurrency race condition. When tested with 15 simultaneous parallel withdrawal requests for $100 against an account with only $100, multiple threads read the initial balance before any write committed, resulting in duplicate withdrawals and negative balances. Furthermore, when two users transferred money to each other simultaneously, unsorted locking caused thread deadlocks.
- **What I did instead**:
  1. Built pessimistic mutex locking with lexicographical account ID sorting (`store.withLock([acc1, acc2])`) to eliminate circular lock wait deadlocks.
  2. Moved balance verification inside the locked ACID transaction.
  3. Verified with an automated multi-threaded concurrency stress test (`backend/tests/concurrency/raceCondition.test.js`): out of 15 simultaneous requests, exactly 1 succeeded, 14 were rejected, and the final balance was strictly $0.00.
- **Commit Reference**: [`80184bb`](file:///D:/snovasys/backend/src/db/store.js), verified in test commit [`28c36f7`](file:///D:/snovasys/backend/tests/concurrency/raceCondition.test.js)


---

## Entry 6: Stranger-Runnable Evaluation & Zero-Friction Setup
- **Date**: 2026-11-07
- **Prompt**:
  > *"Generate project documentation and setup instructions for evaluating LedgerLine."*
- **What the tool produced**:
  Initial documentation assumed external PostgreSQL services, manual user provisioning, environment variable exports for database passwords, and manual DB migration commands before any test could run.
- **What was wrong with it**:
  Severely degraded evaluator experience. Any judge running the application in a fresh sandbox or different operating system without a pre-configured PostgreSQL instance would encounter immediate connection failures, violating the hackathon's "deployment a stranger can run from your README" criterion.
- **What I did instead**:
  Engineered automatic self-seeding on boot if storage is empty, verified all 29 automated tests pass out of the box with zero configuration (`npm test`), and authored a clean, stranger-runnable `README.md` documenting architecture, API endpoints, role credentials, and security guarantees.
- **Commit Reference**: [`README.md`](file:///D:/ledgerline/README.md)

---

## Entry 7: Object-Level Authorization (404 vs 403), Mass-Assignment Protection & Sequence Alignment (Module 2)
- **Date**: 2026-11-08
- **Prompt**:
  > *"Implement Module 2: GET /api/accounts (own), GET /api/accounts/{id}, POST /api/accounts (admin). Foreign id => 404. Test: holder A reading B's account => 404; body with ownerId ignored."*
- **What the tool produced**:
  Initially, standard Spring Security and REST conventions would return HTTP `403 Forbidden` when a HOLDER attempted to access another user's account (`/api/accounts/{id}`). Additionally, client-supplied payloads on `POST /api/accounts` could inadvertently permit `balance` mass-assignment if entity mapping was loose. Furthermore, during test execution with seeded accounts (IDs 1, 2, 3), the database auto-increment sequence remained at 1, causing primary key conflicts on account creation.
- **What was wrong with it**:
  1. Returning `403 Forbidden` for non-owned accounts leaks whether an account ID exists to unauthorized callers, enabling attacker enumeration (BOLA / STRIDE Information Disclosure).
  2. Allowing client-supplied `balance` or `is_system` in account creation payloads enables balance tampering or privilege escalation before any money transaction occurs.
  3. Unsynchronized auto-increment sequence broke subsequent creation of accounts with HTTP 500 duplicate key error.
- **What I did instead**:
  1. In `AccountService.java`, implemented ownership verification that throws `ResourceNotFoundException` (HTTP `404 Not Found`) whenever a HOLDER requests an account they do not own, making non-owned accounts indistinguishable from non-existent accounts.
  2. Enforced strict DTO whitelist in `CreateAccountRequest.java` (only `userId` and `currency` accepted). Hardcoded initial balance strictly to `0L` (paise) in `AccountService.java`.
  3. Added sequence advancement statements (`ALTER TABLE accounts ALTER COLUMN id RESTART WITH 10`) in `V2__seed_data.sql` to advance sequences beyond seeded data across PostgreSQL and H2.
  4. Added 5 comprehensive integration tests in `AuthzIT` covering: holder reading own account (200), holder reading foreign account (404), holder creating account (403), auditor on write (403), and admin creating account with client-supplied balance ignored (201 with balance = 0).
- **Commit Reference**: [`4591a75`](https://github.com/krupavani-29/ledgerline/commit/4591a75)

---

## Entry 8: High-Integrity Money Engine: Pessimistic Row Locking, Atomic Idempotency Claiming, and TOCTOU Race Defense (Module 3)
- **Date**: 2026-11-09
- **Prompt**:
  > *"Before writing code, explain in 5 lines how you will make the balance check safe under concurrent requests. Then implement Module 3 from docs/BRIEF.md (deposits, withdrawals, transfers, balanced ledger legs, idempotency key replay, 422 on payload change, 50 parallel withdrawals under row locking)."*
- **What the tool produced**:
  Initially, the implementation checked account ownership by calling `accountRepository.findById()` prior to calling `accountRepository.findAllByIdInOrderByIdAscForUpdate()` for pessimistic row locking. For idempotency, it attempted PostgreSQL-specific `ON CONFLICT DO NOTHING` inside the primary `@Transactional` boundary and a short 3-second wait for concurrent replay.
- **What was wrong with it**:
  1. Calling `findById()` before the row lock loaded the account entity into Hibernate's first-level session cache. Under concurrent withdrawal requests, threads read the stale cached balance from the persistence context instead of the freshly locked row from the database, introducing a Time-of-Check to Time-of-Use (TOCTOU) race.
  2. The `ON CONFLICT` clause caused SQL syntax parsing errors in H2 test mode, and duplicate key constraint violations within a Hibernate `@Transactional` session marked the transaction as rollback-only.
  3. A tight 3-second polling window in `IdempotencyService` caused tail threads in 20-thread parallel stress tests to time out with HTTP 400 before the winning thread committed the transaction receipt.
- **What I did instead**:
  1. Restructured `LedgerPostingService` so that exclusive row locks are acquired first via `findAllByIdInOrderByIdAscForUpdate(lockOrder)` with account IDs sorted in ascending order (preventing deadlocks). Account ownership and balance checks are executed strictly on the locked entity after the row lock is secured.
  2. Implemented atomic single-statement key claiming using standard ANSI SQL `INSERT INTO idempotency_keys (...) SELECT ... WHERE NOT EXISTS (...)` via `JdbcTemplate` outside the money-movement transaction boundary, avoiding Hibernate session rollback issues and eliminating check-then-insert race conditions.
  3. Increased lock timeout and Hikari pool size in test properties and extended the parallel idempotency polling loop to cleanly replay cached responses to concurrent callers.
  4. Created 6 comprehensive integration tests in `MoneyEngineIT`: input validation (400 on <= 0, > 100M paise, missing header), transfer validation (self-transfer 400, foreign account 404), payload mismatch on key reuse (422), 20 parallel requests with identical key returning single transaction receipt, 50 parallel withdrawals never going negative under concurrent load, and total ledger conservation summing to 0 paise.
- **Commit Reference**: [`a63999e`](https://github.com/krupavani-29/ledgerline/commit/a63999e)

