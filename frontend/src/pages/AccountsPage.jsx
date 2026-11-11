import React, { useState, useEffect, useCallback } from 'react'
import { apiGetAccounts, apiCreateAccount } from '../lib/api.js'
import { formatCents, formatDateShort, formatAccountType } from '../lib/format.js'

/**
 * AccountsPage
 *
 * Displays all accounts visible to the authenticated user:
 *   - ACCOUNT_HOLDER sees only their own accounts.
 *   - AUDITOR / ADMIN sees all accounts in the system.
 *
 * Features:
 *   - Large balance display per ui-reference.html specification
 *   - Account type, status, and currency badges
 *   - Inline "+ New Account" form with account-type selector
 *   - Refresh button with loading state
 */
export default function AccountsPage() {
  const [accounts, setAccounts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchAccounts = useCallback(() => {
    setLoading(true)
    setError(null)
    apiGetAccounts()
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(err  => setError(err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  return (
    <div>
      {/* Page header */}
      <div className="section-header">
        <h2 className="section-title">Accounts</h2>
        <div className="flex-gap">
          <button
            className="btn btn-ghost btn-sm"
            onClick={fetchAccounts}
            disabled={loading}
            aria-label="Refresh account list"
          >
            {loading ? <span className="spinner" /> : '↻'} Refresh
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreate(s => !s)}
          >
            {showCreate ? '✕ Cancel' : '+ New Account'}
          </button>
        </div>
      </div>

      {/* New account form */}
      {showCreate && (
        <div className="mb-4">
          <CreateAccountForm
            onSuccess={() => { setShowCreate(false); fetchAccounts() }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="err" role="alert">
          {error.code && <strong>[{error.code}]</strong>} {error.message}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="loading-center">
          <span className="spinner" /> Loading accounts…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && accounts.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                 stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            No accounts found. Create your first account above.
          </div>
        </div>
      )}

      {/* Account grid */}
      {!loading && accounts.length > 0 && (
        <div className="grid-2">
          {accounts.map(acc => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Account Card ─────────────────────────────────────────────────────────── */

function AccountCard({ account }) {
  const {
    accountNumber, accountType, balanceCents, status, currency, createdAt, ownerName
  } = account

  const statusClass = {
    ACTIVE: 'badge-ok',
    FROZEN: 'badge-warn',
    CLOSED: 'badge-muted',
  }[status] || 'badge-muted'

  return (
    <div className="card account-card">
      <div className="acc-header">
        <div>
          <div className="acc-number">{accountNumber}</div>
          <div className="acc-type">{formatAccountType(accountType)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className={`badge ${statusClass}`}>{status}</span>
          <span className="chip">{currency || 'USD'}</span>
        </div>
      </div>

      <div className="balance-display">{formatCents(balanceCents)}</div>

      <div className="acc-footer">
        <span className="text-xs muted">Opened {formatDateShort(createdAt)}</span>
        {ownerName && ownerName !== 'System' && (
          <span className="text-xs muted">Owner: {ownerName}</span>
        )}
      </div>
    </div>
  )
}

/* ── Create Account Form ──────────────────────────────────────────────────── */

function CreateAccountForm({ onSuccess }) {
  const [accountType, setAccountType] = useState('USER_CHECKING')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [success, setSuccess]         = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const data = await apiCreateAccount(accountType)
      setSuccess(data)
      setTimeout(() => onSuccess(), 1200)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3 className="section-title mb-3">Open New Account</h3>

      {error && (
        <div className="err" role="alert">
          {error.code && <strong>[{error.code}]</strong>} {error.message}
        </div>
      )}
      {success && (
        <div className="success" role="status">
          ✓ Account <strong>{success.accountNumber}</strong> created successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="acc-type-select">Account Type</label>
          <select
            id="acc-type-select"
            className="form-control"
            value={accountType}
            onChange={e => setAccountType(e.target.value)}
          >
            <option value="USER_CHECKING">Checking Account</option>
            <option value="USER_SAVINGS">Savings Account</option>
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !!success}>
          {loading ? <><span className="spinner" /> Creating…</> : 'Open Account'}
        </button>
      </form>
    </div>
  )
}
