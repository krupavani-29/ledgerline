/**
 * @module format
 * @description Monetary and date formatting utilities for LedgerLine.
 *
 * The backend stores all monetary values as integer cents (USD).
 * Display helpers convert to formatted dollar strings using the
 * Intl.NumberFormat API for locale-correct output.
 */

/**
 * Format an integer cent value as a USD dollar string.
 * @param {number|null|undefined} cents - Amount in cents.
 * @returns {string} e.g. 123456 → "$1,234.56" | null → "—"
 *
 * @example
 * formatCents(5000)   // "$50.00"
 * formatCents(0)      // "$0.00"
 * formatCents(null)   // "—"
 */
export function formatCents(cents) {
  if (cents === null || cents === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Parse a user-entered dollar string to a float suitable for the API.
 * Strips commas and non-numeric characters (except `.`).
 * @param {string|number} value
 * @returns {number} e.g. "1,234.56" → 1234.56 | "" → 0
 */
export function parseDollars(value) {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

/**
 * Format an ISO 8601 timestamp to a short date + time string.
 * @param {string|null} iso
 * @returns {string} e.g. "Nov 15, 2024, 10:30" | null → "—"
 */
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-US', {
    month:  'short',
    day:    '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/**
 * Format an ISO 8601 timestamp to a date-only string.
 * @param {string|null} iso
 * @returns {string} e.g. "Nov 15, 2024" | null → "—"
 */
export function formatDateShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day:   '2-digit',
    year:  'numeric',
  }).format(d)
}

/**
 * Map an internal account-type enum to a human-readable label.
 * @param {string} type - e.g. "USER_CHECKING"
 * @returns {string} e.g. "Checking"
 */
export function formatAccountType(type) {
  const labels = {
    USER_CHECKING:  'Checking',
    USER_SAVINGS:   'Savings',
    SYSTEM_RESERVE: 'System Reserve',
    SYSTEM_EQUITY:  'System Equity',
  }
  return labels[type] || type || '—'
}

/**
 * Map a transaction direction enum to a display label.
 * @param {'CREDIT'|'DEBIT'} direction
 * @returns {string}
 */
export function formatDirection(direction) {
  if (direction === 'CREDIT') return 'Credit'
  if (direction === 'DEBIT')  return 'Debit'
  return direction || '—'
}

/**
 * Truncate a string to `maxLen` characters, appending "…" if clipped.
 * @param {string} str
 * @param {number} maxLen
 */
export function truncate(str, maxLen = 48) {
  if (!str) return ''
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str
}
