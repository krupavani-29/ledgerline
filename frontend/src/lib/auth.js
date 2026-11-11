/**
 * @module auth
 * @description JWT decode and auth-state helpers for LedgerLine.
 *
 * All auth state is persisted in localStorage under the `llt_` namespace
 * to avoid collisions with other apps on the same origin.
 *
 * Keys used:
 *   llt_token    – raw JWT string
 *   llt_username – display username
 *   llt_role     – ADMIN | ACCOUNT_HOLDER | AUDITOR
 *   llt_fullname – user's full name for display
 */

/**
 * Decode a JWT payload section without verifying the signature.
 * Used only for expiry checks and UI display — the backend validates all tokens.
 * @param {string} token
 * @returns {object|null} Decoded payload, or null on failure.
 */
export function decodeJwt(token) {
  if (!token) return null
  try {
    const b64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

/**
 * Persist authentication data returned from login/register into localStorage.
 * @param {{user: {username, role, fullName}, token: string}} auth
 */
export function saveAuth({ user, token }) {
  localStorage.setItem('llt_token',    token                              || '')
  localStorage.setItem('llt_username', user?.username                    || '')
  localStorage.setItem('llt_role',     user?.role                        || '')
  localStorage.setItem('llt_fullname', user?.fullName || user?.username  || '')
}

/**
 * Remove all LedgerLine auth state from localStorage.
 * Called on logout or token expiry.
 */
export function clearAuth() {
  ;['llt_token', 'llt_username', 'llt_role', 'llt_fullname'].forEach(k =>
    localStorage.removeItem(k)
  )
}

/** @returns {string} The raw JWT token, or empty string. */
export const getToken    = () => localStorage.getItem('llt_token')    || ''

/** @returns {string} The authenticated user's username. */
export const getUsername = () => localStorage.getItem('llt_username') || ''

/** @returns {string} The authenticated user's role string. */
export const getRole     = () => localStorage.getItem('llt_role')     || ''

/** @returns {string} The authenticated user's full name. */
export const getFullName = () => localStorage.getItem('llt_fullname') || ''

/**
 * Check whether a valid, non-expired token exists in localStorage.
 * Clears auth and returns false if the token has expired.
 * @returns {boolean}
 */
export function isAuthenticated() {
  const token = getToken()
  if (!token) return false
  const payload = decodeJwt(token)
  if (!payload) return false
  // `exp` is in seconds; check against current time
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    clearAuth()
    return false
  }
  return true
}

/** @returns {boolean} True if the current user has the ADMIN role. */
export const isAdmin = () => getRole() === 'ADMIN'

/**
 * @returns {boolean} True if the current user is an AUDITOR or ADMIN.
 * Both roles may access audit logs and integrity checks.
 */
export const isAuditorOrAdmin = () => ['AUDITOR', 'ADMIN'].includes(getRole())

/** @returns {boolean} True if the current user is an ACCOUNT_HOLDER. */
export const isAccountHolder = () => getRole() === 'ACCOUNT_HOLDER'
