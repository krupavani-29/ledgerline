/**
 * @module api
 * @description Centralised API client for LedgerLine.
 *
 * All authenticated requests attach the JWT Bearer token stored in
 * localStorage. API responses are unwrapped from the `{success, data}`
 * envelope and errors are normalised to `{code, message}` for inline display.
 *
 * Base URL is intentionally left as `/api` so Vite's dev-server proxy
 * forwards requests to http://localhost:5000.
 */

const BASE = '/api'

/** @returns {string} The stored JWT token, or empty string. */
function getToken() {
  return localStorage.getItem('llt_token') || ''
}

/**
 * Build fetch headers including JSON content-type, Authorization bearer,
 * and any caller-supplied extras (e.g. Idempotency-Key).
 * @param {Record<string,string>} extra - Additional headers to merge.
 */
function authHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

/**
 * Consume a fetch Response, unwrap the `{success, data}` envelope, and
 * throw a structured error on non-2xx status.
 * @param {Response} res - Raw fetch response.
 * @returns {Promise<any>} Unwrapped `data` payload.
 */
async function handleResponse(res) {
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : {} } catch { body = { message: text } }

  if (!res.ok) {
    const err = new Error(
      body?.error?.message || body?.message || `HTTP ${res.status}`
    )
    err.code    = body?.error?.code || String(res.status)
    err.message = body?.error?.message || body?.message || `Request failed (${res.status})`
    throw err
  }

  // Unwrap envelope: `{success: true, data: {...}}` → `{...}`
  return body?.data !== undefined ? body.data : body
}

// ── Authentication ────────────────────────────────────────────────────────────

/**
 * Log in with username + password.
 * @returns {Promise<{user, token}>}
 */
export async function apiLogin(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, password }),
  })
  return handleResponse(res)
}

/**
 * Register a new user. Email is required by the backend.
 * @returns {Promise<{user, defaultAccount, token}>}
 */
export async function apiRegister(username, email, password, fullName = '') {
  const res = await fetch(`${BASE}/auth/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username, email, password, fullName }),
  })
  return handleResponse(res)
}

/** Fetch the current authenticated user's profile. */
export async function apiGetMe() {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() })
  return handleResponse(res)
}

// ── Accounts ──────────────────────────────────────────────────────────────────

/**
 * List accounts. Regular users see only their own; AUDITOR/ADMIN see all.
 * @returns {Promise<Array<{id, accountNumber, accountType, balanceCents, balanceDollars, status, currency, createdAt, ownerName}>>}
 */
export async function apiGetAccounts() {
  const res = await fetch(`${BASE}/accounts`, { headers: authHeaders() })
  return handleResponse(res)
}

/**
 * Create a new account for the authenticated user.
 * @param {'USER_CHECKING'|'USER_SAVINGS'} accountType
 */
export async function apiCreateAccount(accountType = 'USER_CHECKING') {
  const res = await fetch(`${BASE}/accounts`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ accountType }),
  })
  return handleResponse(res)
}

/**
 * Fetch the full ledger statement for one account.
 * Returns entries newest-first.
 * @returns {Promise<{accountId, accountNumber, currentBalanceCents, currentBalanceDollars, totalTransactions, statement: Array}>}
 */
export async function apiGetStatement(accountId) {
  const res = await fetch(`${BASE}/accounts/${accountId}/statement`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Deposit funds into an account.
 * @param {string}  idempotencyKey  UUID generated on form mount; reused on retry.
 * @param {string}  accountId       Target account internal ID.
 * @param {number}  amount          Dollar value as float, e.g. 10.50.
 * @param {string}  description     Optional memo.
 */
export async function apiDeposit(idempotencyKey, accountId, amount, description = '') {
  const res = await fetch(`${BASE}/transactions/deposit`, {
    method:  'POST',
    headers: authHeaders({ 'Idempotency-Key': idempotencyKey }),
    body:    JSON.stringify({ accountId, amount, description }),
  })
  return handleResponse(res)
}

/**
 * Withdraw funds from an account.
 * Same shape as deposit.
 */
export async function apiWithdraw(idempotencyKey, accountId, amount, description = '') {
  const res = await fetch(`${BASE}/transactions/withdraw`, {
    method:  'POST',
    headers: authHeaders({ 'Idempotency-Key': idempotencyKey }),
    body:    JSON.stringify({ accountId, amount, description }),
  })
  return handleResponse(res)
}

/**
 * Transfer funds between two accounts.
 * @param {string} idempotencyKey
 * @param {string} sourceAccountId          Internal ID of the source account.
 * @param {string} destinationAccountNumber Account NUMBER string of the destination (e.g. "LL-ACC-123456").
 * @param {number} amount                   Dollar value as float.
 * @param {string} description
 */
export async function apiTransfer(idempotencyKey, sourceAccountId, destinationAccountNumber, amount, description = '') {
  const res = await fetch(`${BASE}/transactions/transfer`, {
    method:  'POST',
    headers: authHeaders({ 'Idempotency-Key': idempotencyKey }),
    body:    JSON.stringify({ sourceAccountId, destinationAccountNumber, amount, description }),
  })
  return handleResponse(res)
}

// ── Audit (AUDITOR / ADMIN only) ──────────────────────────────────────────────

/**
 * Retrieve paginated audit log entries, newest first.
 * @returns {Promise<{total, limit, offset, logs: Array}>}
 */
export async function apiGetAuditLogs(limit = 50, offset = 0) {
  const res = await fetch(`${BASE}/audit/logs?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

/**
 * Cryptographically verify the hash-chain integrity of the audit log.
 * @returns {Promise<{isValid, totalEntries, genesisHash, headHash, message}>}
 */
export async function apiVerifyChain() {
  const res = await fetch(`${BASE}/audit/verify-chain`, { headers: authHeaders() })
  return handleResponse(res)
}

/**
 * Verify that total debits == total credits across all ledger entries.
 * @returns {Promise<{isBalanced, ...}>}
 */
export async function apiConservationCheck() {
  const res = await fetch(`${BASE}/audit/conservation-check`, { headers: authHeaders() })
  return handleResponse(res)
}

// ── Admin (ADMIN only) ────────────────────────────────────────────────────────

/** Retrieve all registered users. */
export async function apiAdminGetUsers() {
  const res = await fetch(`${BASE}/admin/users`, { headers: authHeaders() })
  return handleResponse(res)
}

/** Retrieve aggregated system statistics. */
export async function apiAdminGetStats() {
  const res = await fetch(`${BASE}/admin/system-stats`, { headers: authHeaders() })
  return handleResponse(res)
}

/**
 * Update an account's operational status.
 * @param {string} accountId
 * @param {'ACTIVE'|'FROZEN'|'CLOSED'} status
 * @param {string} reason  Audit reason string.
 */
export async function apiAdminUpdateAccountStatus(accountId, status, reason = '') {
  const res = await fetch(`${BASE}/admin/accounts/${accountId}/status`, {
    method:  'PATCH',
    headers: authHeaders(),
    body:    JSON.stringify({ status, reason }),
  })
  return handleResponse(res)
}
