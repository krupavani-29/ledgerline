import React, { useState, useEffect } from 'react'
import { apiGetAccounts, apiDeposit, apiWithdraw, apiTransfer } from '../lib/api.js'
import { formatCents, parseDollars } from '../lib/format.js'

/**
 * Generate a new RFC-4122 UUID for idempotency keys.
 * @returns {string}
 */
function newUUID() { return crypto.randomUUID() }

/**
 * TransferPage
 *
 * Three sub-tabs: Deposit | Withdrawal | Transfer
 *
 * Idempotency key behaviour (per spec):
 *   - Generated once on form MOUNT via useState initialiser.
 *   - Reused on retry (failed requests keep the same key).
 *   - Regenerated only after a SUCCESSFUL transaction.
 */
export default function TransferPage() {
  const [tab, setTab]           = useState('deposit')
  const [accounts, setAccounts] = useState([])
  const [acctLoading, setAcctLoading] = useState(true)
  const [acctError, setAcctError]     = useState(null)

  useEffect(() => {
    setAcctLoading(true)
    apiGetAccounts()
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(err  => setAcctError(err))
      .finally(() => setAcctLoading(false))
  }, [])

  return (
    <div>
      <h2 className="section-title mb-4">Money Movement</h2>

      {/* Sub-tab bar */}
      <div className="tab-bar">
        {['deposit', 'withdrawal', 'transfer'].map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
            type="button"
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {acctError && (
        <div className="err" role="alert">
          {acctError.code && <strong>[{acctError.code}]</strong>} {acctError.message}
        </div>
      )}

      {acctLoading ? (
        <div className="loading-center"><span className="spinner" /> Loading accounts…</div>
      ) : (
        <div style={{ maxWidth: 500 }}>
          {tab === 'deposit'    && <DepositForm    accounts={accounts} />}
          {tab === 'withdrawal' && <WithdrawalForm accounts={accounts} />}
          {tab === 'transfer'   && <TransferForm   accounts={accounts} />}
        </div>
      )}
    </div>
  )
}

/* ── Shared form field components ─────────────────────────────────────────── */

function AccountSelect({ id, label, accounts, value, onChange, required = true }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="form-control"
        required={required}
        value={value}
        onChange={onChange}
      >
        <option value="">— Select account —</option>
        {accounts.map(a => (
          <option key={a.id} value={a.id}>
            {a.accountNumber} · {formatCents(a.balanceCents)}
          </option>
        ))}
      </select>
    </div>
  )
}

function AmountField({ id, value, onChange }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>Amount (USD)</label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--mut)', fontWeight: 600, pointerEvents: 'none'
        }}>$</span>
        <input
          id={id}
          className="form-control"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          required
          style={{ paddingLeft: 24 }}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

function DescriptionField({ id, value, onChange, placeholder = 'Optional memo' }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>Description</label>
      <input
        id={id}
        className="form-control"
        type="text"
        maxLength={120}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

/** Shows the idempotency key so users can see it's preserved across retries. */
function IdempotencyDisplay({ ikey }) {
  return (
    <div className="ikey-display" title="This key prevents duplicate transactions on retry">
      <span style={{ color: 'var(--acc)', flexShrink: 0 }}>🔑</span>
      <span style={{ opacity: 0.6 }}>Idempotency key:</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ikey}
      </span>
    </div>
  )
}

/** Render the success banner from a transaction response. */
function TxnSuccess({ data, label }) {
  return (
    <div className="success" role="status">
      ✓ {label} successful!{' '}
      {data?.transactionId && (
        <span>Txn ID: <code className="mono">{data.transactionId.slice(0, 12)}…</code></span>
      )}
      {data?.balanceDollars && (
        <span style={{ marginLeft: 8 }}>New balance: <strong>${data.balanceDollars}</strong></span>
      )}
      {data?.fromAccount && (
        <span style={{ display: 'block', marginTop: 4 }}>
          {data.fromAccount} → {data.toAccount}
        </span>
      )}
    </div>
  )
}

/* ── Deposit Form ─────────────────────────────────────────────────────────── */

function DepositForm({ accounts }) {
  // Idempotency key generated ONCE on mount
  const [ikey, setIkey]       = useState(() => newUUID())
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount]   = useState('')
  const [desc, setDesc]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const dollars = parseDollars(amount)
      const data    = await apiDeposit(ikey, accountId, dollars, desc)
      setSuccess(data)
      setIkey(newUUID())            // ← regenerate key only on success
      setAmount('')
      setDesc('')
      setAccountId('')
    } catch (err) {
      setError(err)                 // ← keep same key for retry
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h3 className="section-title mb-3">Deposit Funds</h3>

      {error   && <div className="err" role="alert">
        {error.code && <strong>[{error.code}]</strong>} {error.message}
      </div>}
      {success && <TxnSuccess data={success} label="Deposit" />}

      <AccountSelect
        id="dep-account"
        label="Into Account"
        accounts={accounts}
        value={accountId}
        onChange={e => setAccountId(e.target.value)}
      />
      <AmountField
        id="dep-amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <DescriptionField
        id="dep-desc"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="e.g. Salary credit"
      />

      <IdempotencyDisplay ikey={ikey} />

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? <><span className="spinner" /> Processing…</> : 'Deposit'}
      </button>
    </form>
  )
}

/* ── Withdrawal Form ──────────────────────────────────────────────────────── */

function WithdrawalForm({ accounts }) {
  const [ikey, setIkey]       = useState(() => newUUID())
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount]   = useState('')
  const [desc, setDesc]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const dollars = parseDollars(amount)
      const data    = await apiWithdraw(ikey, accountId, dollars, desc)
      setSuccess(data)
      setIkey(newUUID())
      setAmount('')
      setDesc('')
      setAccountId('')
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h3 className="section-title mb-3">Withdraw Funds</h3>

      {error   && <div className="err" role="alert">
        {error.code && <strong>[{error.code}]</strong>} {error.message}
      </div>}
      {success && <TxnSuccess data={success} label="Withdrawal" />}

      <AccountSelect
        id="wd-account"
        label="From Account"
        accounts={accounts}
        value={accountId}
        onChange={e => setAccountId(e.target.value)}
      />
      <AmountField
        id="wd-amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <DescriptionField
        id="wd-desc"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="e.g. ATM withdrawal"
      />

      <IdempotencyDisplay ikey={ikey} />

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? <><span className="spinner" /> Processing…</> : 'Withdraw'}
      </button>
    </form>
  )
}

/* ── Transfer Form ────────────────────────────────────────────────────────── */

function TransferForm({ accounts }) {
  const [ikey, setIkey]           = useState(() => newUUID())
  const [sourceAccountId, setSourceAccountId]           = useState('')
  const [destinationAccountNumber, setDestAccNumber]    = useState('')
  const [amount, setAmount]       = useState('')
  const [desc, setDesc]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!destinationAccountNumber.trim()) {
      setError({ message: 'Destination account number is required.', code: 'VALIDATION' })
      return
    }

    setLoading(true)
    try {
      const dollars = parseDollars(amount)
      const data    = await apiTransfer(
        ikey,
        sourceAccountId,
        destinationAccountNumber.trim().toUpperCase(),
        dollars,
        desc
      )
      setSuccess(data)
      setIkey(newUUID())
      setAmount('')
      setDesc('')
      setSourceAccountId('')
      setDestAccNumber('')
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h3 className="section-title mb-3">Transfer Between Accounts</h3>

      {error   && <div className="err" role="alert">
        {error.code && <strong>[{error.code}]</strong>} {error.message}
      </div>}
      {success && <TxnSuccess data={success} label="Transfer" />}

      <AccountSelect
        id="tx-source"
        label="From Account"
        accounts={accounts}
        value={sourceAccountId}
        onChange={e => setSourceAccountId(e.target.value)}
      />

      <div className="form-group">
        <label htmlFor="tx-dest">To Account Number</label>
        <input
          id="tx-dest"
          className="form-control"
          type="text"
          required
          placeholder="e.g. LL-ACC-123456"
          value={destinationAccountNumber}
          onChange={e => setDestAccNumber(e.target.value)}
        />
        <span className="form-hint">
          Enter the recipient's full account number (found on their Accounts page).
        </span>
      </div>

      <AmountField
        id="tx-amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <DescriptionField
        id="tx-desc"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="e.g. Rent payment"
      />

      <IdempotencyDisplay ikey={ikey} />

      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? <><span className="spinner" /> Processing…</> : 'Send Transfer'}
      </button>
    </form>
  )
}
