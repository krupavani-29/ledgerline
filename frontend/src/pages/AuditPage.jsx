import React, { useState, useEffect, useCallback } from 'react'
import { apiGetAuditLogs, apiVerifyChain, apiConservationCheck } from '../lib/api.js'
import { formatDate, truncate } from '../lib/format.js'

/**
 * AuditPage
 *
 * Visible to AUDITOR and ADMIN roles only (enforced by route guard + backend).
 *
 * Sections:
 *   1. System Integrity Panel — conservation check + hash-chain verification
 *   2. Audit Trail table      — paginated "Load more" (offset-based)
 *
 * Action badge colouring:
 *   - SECURITY_* → red
 *   - DEPOSIT / WITHDRAWAL / TRANSFER → blue
 *   - LOGIN_* → muted
 *   - Everything else → muted
 */

const LOG_PAGE = 50

export default function AuditPage() {
  // ── Integrity state ────────────────────────────────────────────────────────
  const [conservation, setConservation]       = useState(null)
  const [chain, setChain]                     = useState(null)
  const [integrityLoading, setIntegrityLoading] = useState(true)
  const [integrityError, setIntegrityError]   = useState(null)

  // ── Audit log state ────────────────────────────────────────────────────────
  const [logs, setLogs]         = useState([])
  const [total, setTotal]       = useState(0)
  const [offset, setOffset]     = useState(0)
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState(null)
  const [hasMore, setHasMore]   = useState(false)

  // ── Fetch integrity data ───────────────────────────────────────────────────
  const fetchIntegrity = useCallback(() => {
    setIntegrityLoading(true)
    setIntegrityError(null)
    Promise.all([apiConservationCheck(), apiVerifyChain()])
      .then(([cons, ch]) => { setConservation(cons); setChain(ch) })
      .catch(err => setIntegrityError(err))
      .finally(() => setIntegrityLoading(false))
  }, [])

  // ── Fetch audit log (initial or load-more) ─────────────────────────────────
  const fetchLogs = useCallback((currentOffset = 0, append = false) => {
    setLogLoading(true)
    setLogError(null)
    apiGetAuditLogs(LOG_PAGE, currentOffset)
      .then(data => {
        const incoming = data.logs || []
        setTotal(data.total || 0)
        setLogs(prev => append ? [...prev, ...incoming] : incoming)
        setOffset(currentOffset + incoming.length)
        setHasMore(currentOffset + incoming.length < (data.total || 0))
      })
      .catch(err => setLogError(err))
      .finally(() => setLogLoading(false))
  }, [])

  useEffect(() => { fetchIntegrity() }, [fetchIntegrity])
  useEffect(() => { fetchLogs(0, false) }, [fetchLogs])

  function handleLoadMore() { fetchLogs(offset, true) }

  function handleRefreshAll() {
    setLogs([])
    setOffset(0)
    fetchIntegrity()
    fetchLogs(0, false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="section-header">
        <h2 className="section-title">Audit &amp; Integrity</h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleRefreshAll}
          disabled={integrityLoading || logLoading}
        >
          {(integrityLoading || logLoading) ? <span className="spinner" /> : '↻'} Refresh
        </button>
      </div>

      {/* ── 1. Integrity Panel ── */}
      <h3 className="text-xs muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        System Integrity
      </h3>

      {integrityError && (
        <div className="err" role="alert">
          {integrityError.code && <strong>[{integrityError.code}]</strong>} {integrityError.message}
        </div>
      )}

      {integrityLoading ? (
        <div className="loading-center mb-4"><span className="spinner" /> Verifying integrity…</div>
      ) : (
        <div className="integrity-grid">
          {/* Conservation badge */}
          <div className="integrity-badge">
            <span className="ib-label">Ledger Conservation</span>
            {conservation !== null ? (
              <>
                <span className={`badge ${conservation.isBalanced ? 'badge-ok' : 'badge-err'}`}>
                  {conservation.isBalanced ? '✓ Balanced' : '✗ Unbalanced'}
                </span>
                <span className="ib-status">
                  {conservation.isBalanced
                    ? 'Total debits equal total credits.'
                    : 'Ledger imbalance detected — investigate immediately.'}
                </span>
              </>
            ) : <span className="badge badge-muted">— Unknown</span>}
          </div>

          {/* Hash-chain badge */}
          <div className="integrity-badge">
            <span className="ib-label">Audit Hash Chain</span>
            {chain !== null ? (
              <>
                <span className={`badge ${chain.isValid ? 'badge-ok' : 'badge-err'}`}>
                  {chain.isValid ? '✓ Intact' : '✗ Compromised'}
                </span>
                <span className="ib-status">
                  {chain.isValid
                    ? `${chain.totalEntries} entries verified cryptographically.`
                    : chain.error || 'Hash chain verification failed.'}
                </span>
              </>
            ) : <span className="badge badge-muted">— Unknown</span>}
          </div>

          {/* Chain head info */}
          {chain?.isValid && chain.headHash && (
            <div className="integrity-badge">
              <span className="ib-label">Chain Head</span>
              <code className="mono" style={{ fontSize: '0.74rem', color: 'var(--mut)', wordBreak: 'break-all' }}>
                {chain.headHash.slice(0, 32)}…
              </code>
            </div>
          )}
        </div>
      )}

      <hr className="divider" />

      {/* ── 2. Audit Log Table ── */}
      <div className="section-header">
        <h3 className="section-title">
          Audit Trail
          {total > 0 && (
            <span className="chip" style={{ marginLeft: 10 }}>{total} entries</span>
          )}
        </h3>
      </div>

      {logError && (
        <div className="err" role="alert">
          {logError.code && <strong>[{logError.code}]</strong>} {logError.message}
        </div>
      )}

      {!logLoading && logs.length === 0 && !logError && (
        <div className="card">
          <div className="empty-state">No audit records found.</div>
        </div>
      )}

      {logs.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id || i}>
                    <td className="num muted" style={{ fontSize: '0.78rem' }}>
                      {log.sequenceNum}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--mut)' }}>
                      {formatDate(log.timestamp)}
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.actorId?.slice(0, 12) || '—'}</td>
                    <td>
                      <span className="chip" style={{ fontSize: '0.7rem' }}>
                        {log.actorRole?.replace('_', ' ') || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${actionBadgeClass(log.action)}`} style={{ fontSize: '0.7rem' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--mut)' }}>
                      {log.resourceType}{log.resourceId ? ` · ${log.resourceId.slice(0, 12)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          <div className="pagination">
            <span className="page-info">
              Showing {logs.length} of {total}
            </span>
            {hasMore && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleLoadMore}
                disabled={logLoading}
              >
                {logLoading ? <><span className="spinner" /> Loading…</> : `Load more (${total - logs.length} remaining)`}
              </button>
            )}
          </div>
        </>
      )}

      {logLoading && logs.length === 0 && (
        <div className="loading-center"><span className="spinner" /> Loading audit log…</div>
      )}
    </div>
  )
}

/**
 * Map an audit action string to a badge colour class.
 * - SECURITY_* → red (err)
 * - DEPOSIT / WITHDRAWAL / TRANSFER → blue (info)
 * - LOGIN_* → muted
 * - ACCOUNT_* → warn
 */
function actionBadgeClass(action) {
  if (!action) return 'badge-muted'
  if (action.startsWith('SECURITY_'))    return 'badge-err'
  if (action.includes('DEPOSIT') || action.includes('WITHDRAWAL') || action.includes('TRANSFER'))
    return 'badge-info'
  if (action.startsWith('ACCOUNT_'))     return 'badge-warn'
  if (action.startsWith('LOGIN_') || action === 'USER_REGISTERED') return 'badge-muted'
  return 'badge-muted'
}
