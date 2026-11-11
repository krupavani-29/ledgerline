import React, { useState, useEffect, useCallback } from 'react'
import { apiGetAccounts, apiGetStatement } from '../lib/api.js'
import { formatCents, formatDate, formatAccountType } from '../lib/format.js'

/**
 * StatementPage
 *
 * Shows a paginated ledger statement for the selected account.
 * The backend returns all entries newest-first; we display the most
 * recent 50 and offer a "Show all" toggle for accounts with more entries.
 *
 * Table columns per ui-reference.html:
 *   Date | Description | Type | Direction | Amount | Running Balance
 *
 * Colour coding:
 *   - CREDIT entries: green (var(--cr))
 *   - DEBIT  entries: red   (var(--dr))
 */

const PAGE_SIZE = 50

export default function StatementPage() {
  const [accounts, setAccounts]     = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [statement, setStatement]   = useState(null)
  const [loading, setLoading]       = useState(false)
  const [acctLoading, setAcctLoading] = useState(true)
  const [error, setError]           = useState(null)
  const [showAll, setShowAll]       = useState(false)

  // Load accounts list on mount
  useEffect(() => {
    setAcctLoading(true)
    apiGetAccounts()
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setAccounts(list)
        if (list.length > 0) setSelectedId(list[0].id)
      })
      .catch(err => setError(err))
      .finally(() => setAcctLoading(false))
  }, [])

  // Fetch statement whenever selected account changes
  const fetchStatement = useCallback(() => {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    setShowAll(false)
    apiGetStatement(selectedId)
      .then(data => setStatement(data))
      .catch(err  => setError(err))
      .finally(() => setLoading(false))
  }, [selectedId])

  useEffect(() => { fetchStatement() }, [fetchStatement])

  function handleAccountChange(e) {
    setSelectedId(e.target.value)
    setStatement(null)
  }

  // Determine which rows to display
  const allRows     = statement?.statement || []
  const displayRows = showAll ? allRows : allRows.slice(0, PAGE_SIZE)
  const hasMore     = allRows.length > PAGE_SIZE && !showAll

  // Find the selected account object for the header
  const selectedAccount = accounts.find(a => a.id === selectedId)

  return (
    <div>
      {/* Page header */}
      <div className="section-header">
        <h2 className="section-title">Account Statement</h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={fetchStatement}
          disabled={loading || !selectedId}
          aria-label="Refresh statement"
        >
          {loading ? <span className="spinner" /> : '↻'} Refresh
        </button>
      </div>

      {/* Account selector */}
      {acctLoading ? (
        <div className="loading-center"><span className="spinner" /> Loading accounts…</div>
      ) : (
        <div className="card mb-4">
          <div className="form-group mb-0">
            <label htmlFor="stmt-account">Select Account</label>
            <select
              id="stmt-account"
              className="form-control"
              value={selectedId}
              onChange={handleAccountChange}
              disabled={loading}
            >
              {accounts.length === 0 && (
                <option value="">No accounts available</option>
              )}
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.accountNumber} — {formatAccountType(a.accountType)} — {formatCents(a.balanceCents)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="err" role="alert">
          {error.code && <strong>[{error.code}]</strong>} {error.message}
        </div>
      )}

      {/* Statement header summary */}
      {statement && selectedAccount && (
        <div className="card mb-4" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>Account</div>
            <code className="mono" style={{ fontSize: '0.9rem' }}>{statement.accountNumber}</code>
          </div>
          <div>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>Current Balance</div>
            <span className="balance-display" style={{ fontSize: '1.4rem' }}>
              {formatCents(statement.currentBalanceCents)}
            </span>
          </div>
          <div>
            <div className="text-xs muted" style={{ marginBottom: 4 }}>Total Transactions</div>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{statement.totalTransactions}</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-center"><span className="spinner" /> Loading statement…</div>
      )}

      {/* Statement table */}
      {!loading && statement && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th className="r">Amount</th>
                  <th className="r">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--mut)', padding: '32px 0' }}>
                      No transactions yet.
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row, i) => {
                    const isCredit = row.direction === 'CREDIT'
                    return (
                      <tr key={row.legId || i}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--mut)', fontSize: '0.82rem' }}>
                          {formatDate(row.timestamp)}
                        </td>
                        <td>{row.description || '—'}</td>
                        <td>
                          <span className={`badge ${txnTypeClass(row.type)}`} style={{ fontSize: '0.7rem' }}>
                            {row.type}
                          </span>
                        </td>
                        <td>
                          <span className={isCredit ? 'text-cr' : 'text-dr'} style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                            {isCredit ? '▲ Credit' : '▼ Debit'}
                          </span>
                        </td>
                        <td className={`r num ${isCredit ? 'cr' : 'dr'}`}>
                          {formatCents(row.amountCents)}
                        </td>
                        <td className="r num" style={{ fontWeight: 600 }}>
                          {formatCents(row.runningBalanceCents)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Show more */}
          {hasMore && (
            <div className="pagination">
              <span className="page-info">
                Showing {displayRows.length} of {allRows.length} transactions
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAll(true)}
              >
                Show all {allRows.length}
              </button>
            </div>
          )}

          {showAll && allRows.length > PAGE_SIZE && (
            <div className="pagination">
              <span className="page-info">Showing all {allRows.length} transactions</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(false)}>
                Collapse
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Map a transaction type enum to a badge colour class. */
function txnTypeClass(type) {
  if (type === 'DEPOSIT')    return 'badge-ok'
  if (type === 'WITHDRAWAL') return 'badge-err'
  if (type === 'TRANSFER')   return 'badge-info'
  return 'badge-muted'
}
