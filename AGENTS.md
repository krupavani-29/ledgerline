# LedgerLine - rules for the coding agent (read before every task)

Stack: Java 21, Spring Boot 3, Maven, PostgreSQL, Flyway, Spring Security (JWT), React + Vite. Tests: JUnit 5 + Testcontainers.
Goal: money movement where books balance, the same request never pays twice, and the wrong person cannot touch money.

## Non-negotiable rules
1. Money is BIGINT minor units (paise). Never float/double/BigDecimal in the API.
2. Schema changes only through Flyway migrations (db/migration/V*__*.sql). No ddl-auto.
3. Double-entry: each transaction = one `transactions` row + >=2 signed `ledger_entries` summing to 0. Deposits/withdrawals use a system CASH account as the other leg.
4. Overdraft blocked in the service AND by `CHECK (is_system OR balance >= 0)`.
5. `Idempotency-Key` header required on every money endpoint. Store (user_id, key) UNIQUE + request hash + response. Same key+same body = replay original response. Same key+different body = 422. Claim the key with INSERT ... ON CONFLICT DO NOTHING inside the same DB transaction (no check-then-insert).
6. Lock account rows `SELECT ... FOR UPDATE ORDER BY id` inside the single @Transactional method. Read the balance only AFTER locking.
7. Identity comes only from the JWT. Never from request body/params. Ignore/reject unknown fields (ownerId, role, balance) in bodies.
8. Roles ADMIN / HOLDER / AUDITOR enforced server-side (@PreAuthorize + service-level ownership checks). Foreign account => 404, not 403.
   - HOLDER: own accounts only; deposit, withdraw, transfer-from-own, read own statement.
   - AUDITOR: read-only on ledger, audit log, integrity check. Any write => 403.
   - ADMIN: create users/accounts, read all. ADMIN cannot move money from accounts it does not own.
9. `ledger_entries` and `audit_log` are append-only: DB trigger rejects UPDATE/DELETE; app DB user has only INSERT/SELECT on them. Audit rows chain a SHA-256 hash of the previous row.
10. Uniform JSON errors {code, message, traceId}. Never leak stack traces or SQL.
11. Secrets (DB password, JWT secret) come from env vars. Never commit them. Passwords hashed with BCrypt. Rate-limit login.
12. Every feature ships with an integration test. Each test is named in THREATS.md.

## Working style
- One module at a time (docs/BRIEF.md). Stop and wait for my review after each.
- Small commits, message says what and why. Never rewrite history.
- Comment each authorisation/integrity decision with the reason, so I can explain it in an interview.
- Do not claim a feature works unless its test passes. Report failures honestly.
- UI reference: docs/ui-reference.html (open in browser). Match its layout and tokens.
