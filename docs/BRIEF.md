# Module prompts (give to the agent one at a time)

## M1 Schema + auth
Create Flyway V1 (users, accounts, transactions, ledger_entries, idempotency_keys, audit_log, append-only triggers, CHECK constraints) and V2 seed (1 admin, 1 auditor, 2 holders with accounts, 1 system CASH account). JWT login (15 min expiry), BCrypt, role claims, SecurityConfig with stateless sessions, 401/403 JSON handlers. Tests: missing/expired/tampered JWT => 401; auditor on write => 403.

## M2 Accounts + ownership
Endpoints: GET /api/accounts (own), GET /api/accounts/{id}, POST /api/accounts (admin). Foreign id => 404. Test: holder A reading B's account => 404; body with ownerId ignored.

## M3 Money engine
POST /api/deposits, /api/withdrawals, /api/transfers. Follow AGENTS.md rules 3-7. Reject amount <= 0, > 100000000, self-transfer. Tests: 50 parallel withdrawals never go negative; same key x20 parallel => exactly one transaction; same key + different amount => 422; ledger sums to 0.

## M4 Audit + statements
Audit every money action and every denied access attempt (who, what, target, result, ip, time, prev_hash, hash). GET /api/accounts/{id}/statement (paginated), GET /api/audit (auditor/admin), GET /api/integrity (total ledger sum = 0 and each balance = sum of its entries; also verifies hash chain). Tests: UPDATE/DELETE on ledger/audit fails; tampering detected by /api/integrity.

## M5 Frontend
Pages: Login, Accounts, Transfer (auto-generates Idempotency-Key per submit attempt, reuses it on retry), Statement, Audit/Integrity (auditor), Admin. Role-aware navigation (UI hiding is cosmetic only; server enforces). Friendly errors from the {code,message} format. Follow docs/ui-reference.html.

## M6 Ship
Dockerfile + docker-compose, deploy (Render/Railway + Vercel), CORS locked to the frontend origin, security headers, README (run steps, seed logins, curl examples, honest limitations), THREATS.md, test run output. Verify live URL in an incognito window.
