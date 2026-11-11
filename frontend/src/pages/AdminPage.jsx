import React, { useState, useEffect, useCallback } from 'react'
import { apiAdminGetUsers, apiAdminGetStats, apiCreateAccount } from '../lib/api.js'
import { formatCents, formatDateShort } from '../lib/format.js'

/**
 * AdminPage
 *
 * Visible to ADMIN role only (enforced by route guard + backend).
 *
 * Sections:
 *   1. System Stats — headline metrics dashboard
 *   2. Create Account — provision a new account for a user
 *   3. User Directory — table of all registered users
 */
export default function AdminPage() {
  const [stats, setStats]           = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)

  const [users, setUsers]           = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState(null)

  const [showCreate, setShowCreate] = useState(false)

  const fetchStats = useCallback(() => {
    setStatsLoading(true)
    setStatsError(null)
    apiAdminGetStats()
      .then(data => setStats(data))
      .catch(err  => setStatsError(err))
      .finally(() => setStatsLoading(false))
  }, [])

  const fetchUsers = useCallback(() => {
    setUsersLoading(true)
    setUsersError(null)
    apiAdminGetUsers()
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(err  => setUsersError(err))
      .finally(() => setUsersLoading(false))
  }, [])

  useEffect(() => { fetchStats(); fetchUsers() }, [fetchStats, fetchUsers])

  function handleRefresh() { fetchStats(); fetchUsers() }

  return (
    <div>
      {/* Page header */}
      <div className="section-header">
        <h2 className="section-title">Admin Panel</h2>
        <div className="flex-gap">
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={statsLoading || usersLoading}>
            {(statsLoading || usersLoading) ? <span className="spinner" /> : '↻'} Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(s => !s)}>
            {showCreate ? '✕ Cancel' : '+ New Account'}
          </button>
        </div>
      </div>

      {/* ── 1. System Stats ── */}
      <h3 className="text-xs muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        System Overview
      </h3>

      {statsError && (
        <div className="err" role="alert">
          {statsError.code && <strong>[{statsError.code}]</strong>} {statsError.message}
        </div>
      )}

      {statsLoading ? (
        <div className="loading-center mb-4"><span className="spinner" /> Loading stats…</div>
      ) : stats && (
        <div className="grid-3 mb-4">
          <StatCard label="Total Users"     value={stats.totalUsers}     />
          <StatCard label="Total Accounts"  value={stats.totalAccounts}  />
          <StatCard label="Audit Log Size"  value={stats.totalAuditLogs} />
          <StatCard
            label="Total User Funds"
            value={`$${stats.totalUserFundsDollars}`}
            sub="Across all user accounts"
          />
          <StatCard
            label="System Reserve"
            value={`$${stats.systemReserveBalanceDollars}`}
            sub="Settlement account balance"
          />
          <StatCard
            label="Journal Entries"
            value={stats.totalJournalEntries}
            sub="Total double-entry postings"
          />
        </div>
      )}

      {/* ── 2. Create Account ── */}
      {showCreate && (
        <div className="mb-4">
          <CreateAccountForm
            onSuccess={() => { setShowCreate(false) }}
          />
        </div>
      )}

      <hr className="divider" />

      {/* ── 3. User Directory ── */}
      <div className="section-header">
        <h3 className="section-title">
          User Directory
          {users.length > 0 && (
            <span className="chip" style={{ marginLeft: 10 }}>{users.length} users</span>
          )}
        </h3>
      </div>

      {usersError && (
        <div className="err" role="alert">
          {usersError.code && <strong>[{usersError.code}]</strong>} {usersError.message}
        </div>
      )}

      {usersLoading ? (
        <div className="loading-center"><span className="spinner" /> Loading users…</div>
      ) : users.length === 0 ? (
        <div className="card"><div className="empty-state">No users found.</div></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Member Since</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>{user.username}</td>
                  <td>{user.fullName || '—'}</td>
                  <td style={{ color: 'var(--mut)', fontSize: '0.86rem' }}>{user.email || '—'}</td>
                  <td>
                    <span className={`badge ${roleBadgeClass(user.role)}`} style={{ fontSize: '0.7rem' }}>
                      {user.role?.replace('_', ' ') || '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--mut)', fontSize: '0.83rem' }}>
                    {formatDateShort(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
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
      setTimeout(() => onSuccess(), 1500)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3 className="section-title mb-3">Provision New Account</h3>

      {error && (
        <div className="err" role="alert">
          {error.code && <strong>[{error.code}]</strong>} {error.message}
        </div>
      )}
      {success && (
        <div className="success" role="status">
          ✓ Account <strong>{success.accountNumber}</strong> created.
          Type: {success.accountType}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="admin-acc-type">Account Type</label>
          <select
            id="admin-acc-type"
            className="form-control"
            value={accountType}
            onChange={e => setAccountType(e.target.value)}
          >
            <option value="USER_CHECKING">Checking Account</option>
            <option value="USER_SAVINGS">Savings Account</option>
          </select>
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading || !!success}>
          {loading ? <><span className="spinner" /> Creating…</> : 'Create Account'}
        </button>
      </form>
    </div>
  )
}

/* ── Role badge helper ───────────────────────────────────────────────────── */

function roleBadgeClass(role) {
  if (role === 'ADMIN')          return 'badge-err'
  if (role === 'AUDITOR')        return 'badge-warn'
  if (role === 'ACCOUNT_HOLDER') return 'badge-info'
  return 'badge-muted'
}
