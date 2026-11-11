# BalanceVault (LedgerLine) — Financial Ledger Platform

> **"Move money so the books always balance and the same request never pays twice."**  
> A production-grade financial ledger system built with Spring Boot 3.3 + React 18 featuring double-entry accounting, pessimistic concurrency control, strict idempotency, JWT-based RBAC, and a tamper-evident cryptographic audit trail.

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React 18 + Vite SPA                   │
│  Login │ Accounts │ Transfer │ Statement │ Audit │ Admin │
└────────────────────────┬────────────────────────────────┘
                         │  HTTP/JSON  (Vite proxy → :8080)
┌────────────────────────▼────────────────────────────────┐
│          Spring Boot 3.3.5 REST API  (port 8080)        │
│  JWT Auth · RBAC · Rate Limiting · Idempotency          │
│  Double-Entry Ledger Engine · SHA-256 Audit Chain       │
└────────────────────────┬────────────────────────────────┘
                         │  JPA / JDBC
┌────────────────────────▼────────────────────────────────┐
│   PostgreSQL 16  (H2 in-memory for tests via Flyway)    │
│  accounts · ledger_entries · audit_log · transactions   │
│  Append-only triggers on ledger_entries + audit_log     │
└─────────────────────────────────────────────────────────┘
```

### Core Pillars

| # | Pillar | Implementation |
|---|--------|----------------|
| 1 | **Double-Entry Accounting** | Every money movement posts two ledger legs summing to exactly 0. `∑ ledger_entries.amount = 0` always. |
| 2 | **Pessimistic Concurrency** | `SELECT … FOR UPDATE` rows in ascending ID order eliminates deadlocks under concurrent load. |
| 3 | **Idempotency** | `Idempotency-Key` UUID header on all mutations. SHA-256 request-hash detects parameter replay attacks. Returns `X-Idempotent-Replayed: true` on duplicates. |
| 4 | **RBAC + Anti-IDOR** | `ADMIN`, `HOLDER`, `AUDITOR` roles via JWT claims. Foreign account access returns `404` (not `403`) to prevent ID enumeration. |
| 5 | **Cryptographic Audit Trail** | SHA-256 hash-chained append-only log. `GET /api/integrity` traverses every entry from genesis detecting any tampered, inserted, or deleted record. |
| 6 | **Append-Only Tables** | PostgreSQL triggers and H2 `BEFORE UPDATE,DELETE` triggers block any direct modification of `ledger_entries` or `audit_log`. |

---

## 🚀 Quick Start

### Option A — Docker Compose (Recommended)

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env to set a strong JWT_SECRET

# 2. Build and start the full stack (PostgreSQL + Spring Boot app)
docker compose up --build

# App available at http://localhost:8080
# API health: http://localhost:8080/api/health/liveness
```

### Option B — Local Development

**Prerequisites:** Java 21+, Maven 3.9+, Node.js 18+, PostgreSQL 14+ (or use H2 for tests only)

```bash
# --- Backend ---
cd backend

# Configure database (copy and edit application.properties or use env vars)
# spring.datasource.url=jdbc:postgresql://localhost:5432/ledgerline
# jwt.secret=<at-least-32-character-random-string>

# Run tests (H2 in-memory, no Postgres needed)
./mvnw.cmd test          # Windows
./mvnw test              # macOS/Linux

# Start the server
./mvnw.cmd spring-boot:run

# --- Frontend (new terminal) ---
cd frontend
npm install
npm run dev
# SPA available at http://localhost:5173 (proxies /api → localhost:8080)
```

---

## 🧪 Test Results

```
Tests run: 33, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS
```

| Test Suite | Tests | Description |
|------------|-------|-------------|
| `AuditAndIntegrityIT` | 7 | Append-only triggers, hash-chain verification, integrity API |
| `AuthIT` | 5 | Registration, login, rate limiting, JWT validation |
| `AuthzIT` | 6 | RBAC enforcement across all endpoints |
| `MoneyEngineIT` | 6 | Deposit, withdrawal, transfer, idempotency, overdraft guard |
| `OnboardingAndBootstrapIT` | 6 | Admin bootstrap, account creation, HOLDER self-service |
| *(compile-check)* | 3 | Test infrastructure health |

---

## 👥 Seed Demo Credentials

| Role | Username | Password | Account |
|------|----------|----------|---------|
| **Admin** | `admin` | `Password@123` | System management |
| **Account Holder** | `asha` | `Password@123` | `ACC-1042` (₹0.00 initial) |
| **Account Holder** | `ravi` | `Password@123` | `ACC-2817` (₹0.00 initial) |
| **Auditor** | `auditor` | `Password@123` | Read-only ledger access |

---

## 📡 API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | Public | Register user; returns JWT + account number |
| `POST` | `/api/auth/login` | Public | Authenticate; returns `{token, username, role}` |

### Accounts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/accounts` | HOLDER/ADMIN/AUDITOR | List own accounts (ADMIN/AUDITOR see all) |
| `GET` | `/api/accounts/{id}` | HOLDER/ADMIN/AUDITOR | Get single account (HOLDER: 404 if not own) |
| `POST` | `/api/accounts` | ADMIN only | Create account for a user |

### Transactions — All require `Idempotency-Key: <uuid>` header
| Method | Path | Auth | Body |
|--------|------|------|------|
| `POST` | `/api/deposits` | HOLDER/ADMIN | `{accountId, amount, description}` |
| `POST` | `/api/withdrawals` | HOLDER/ADMIN | `{accountId, amount, description}` |
| `POST` | `/api/transfers` | HOLDER/ADMIN | `{sourceAccountId, targetAccountId, amount, description}` |

> All `amount` fields are in **paise** (integer minor units). ₹1.00 = 100 paise.

### Statement & Audit
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/accounts/{id}/statement` | All | Paginated ledger entries (`?page=0&size=20`) |
| `GET` | `/api/audit` | AUDITOR/ADMIN | Paginated audit log |
| `GET` | `/api/integrity` | AUDITOR/ADMIN | Full system integrity report |

### Admin & Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/admin/bootstrap` | Public (once) | Initialize first ADMIN account |
| `GET` | `/api/health/liveness` | Public | Kubernetes liveness probe |
| `GET` | `/api/health/readiness` | Public | Kubernetes readiness probe |

---

## 🔒 Security Design Decisions

- **Stateless JWT** — 15-minute expiry, role embedded in claims, no session storage
- **BCrypt passwords** — work factor 12, never stored in plaintext
- **Rate limiting** — sliding window on auth endpoints (3 requests / 10s per IP)
- **No stack traces in responses** — all errors return `{code, message}` JSON via `GlobalExceptionHandler`
- **AUDITOR write-block** — `SecurityConfig` blocks all `POST/PUT/PATCH/DELETE` for `AUDITOR` role at the filter level
- **Deadlock prevention** — always acquire row locks in ascending account ID order
- **Trigger-enforced immutability** — PostgreSQL triggers (H2 equivalents in tests) block any `UPDATE` or `DELETE` on `ledger_entries` and `audit_log`

---

## 📁 Project Structure

```
ledgerline/
├── backend/                          # Spring Boot 3.3.5 application
│   ├── src/main/java/com/ledgerline/
│   │   ├── controller/               # REST controllers (Auth, Account, Transaction, Audit, etc.)
│   │   ├── service/                  # Business logic (LedgerPosting, AuditService, etc.)
│   │   ├── security/                 # JWT filter, SecurityConfig, rate limiting
│   │   ├── model/                    # JPA entities
│   │   ├── dto/                      # Request/Response records
│   │   ├── repository/               # Spring Data JPA repositories
│   │   └── exception/                # Custom exceptions + GlobalExceptionHandler
│   ├── src/main/resources/
│   │   ├── application.properties    # PostgreSQL + Flyway config
│   │   └── db/migration/
│   │       ├── common/               # V1 schema, V2 seed data (H2 + PostgreSQL)
│   │       └── postgresql/           # V3 append-only triggers (PostgreSQL only)
│   └── src/test/
│       ├── java/com/ledgerline/      # 33 integration tests
│       └── resources/application-test.properties   # H2 test config
│
├── frontend/                         # React 18 + Vite SPA
│   ├── src/
│   │   ├── pages/                    # Login, Accounts, Transfer, Statement, Audit, Admin
│   │   ├── components/               # Layout, ProtectedRoute
│   │   └── lib/                      # api.js, auth.js, format.js
│   └── vite.config.js                # Proxies /api → localhost:8080
│
├── Dockerfile                        # 3-stage multi-build (Node → JDK → JRE)
├── docker-compose.yml                # postgres:16 + app service
└── .env.example                      # Environment variable template
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SPRING_DATASOURCE_URL` | Yes | JDBC URL for PostgreSQL |
| `SPRING_DATASOURCE_USERNAME` | Yes | Database username |
| `SPRING_DATASOURCE_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | Min 32-char random string for HMAC-SHA256 signing |
| `JWT_EXPIRATION_MS` | No | Token TTL in ms (default: `900000` = 15 min) |
| `ADMIN_BOOTSTRAP_SECRET` | No | One-time secret for first admin creation |

---

## 📄 Documentation

- [`THREATS.md`](./THREATS.md) — STRIDE threat model and mitigations
- [`AGENTS.md`](./AGENTS.md) — AI coding agent security rules and decisions
- [`BRIEF.md`](./BRIEF.md) — Technical specification and module breakdown
