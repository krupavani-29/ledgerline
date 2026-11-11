import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { apiLogin, apiRegister } from '../lib/api.js'
import { saveAuth } from '../lib/auth.js'

/**
 * LoginPage
 *
 * Renders a tabbed card with two views:
 *   - "Sign In"  — email/password login
 *   - "Register" — new account registration (requires email field)
 *
 * On success, auth data is persisted and the user is redirected to the
 * page they originally tried to access (or /accounts as fallback).
 */
export default function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || '/accounts'

  const [tab, setTab] = useState('login')

  // ── Login state ────────────────────────────────────────────────────────────
  const [loginForm, setLoginForm]       = useState({ username: '', password: '' })
  const [loginError, setLoginError]     = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // ── Register state ─────────────────────────────────────────────────────────
  const [regForm, setRegForm]       = useState({ username: '', email: '', password: '', confirm: '', fullName: '' })
  const [regError, setRegError]     = useState(null)
  const [regSuccess, setRegSuccess] = useState(null)
  const [regLoading, setRegLoading] = useState(false)

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)
    try {
      const data = await apiLogin(loginForm.username.trim(), loginForm.password)
      saveAuth(data)                        // data = {user, token}
      navigate(from, { replace: true })
    } catch (err) {
      setLoginError(err)
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setRegError(null)
    setRegSuccess(null)

    // Client-side validation
    if (regForm.password !== regForm.confirm) {
      setRegError({ message: 'Passwords do not match.', code: 'VALIDATION' })
      return
    }
    if (regForm.password.length < 8) {
      setRegError({ message: 'Password must be at least 8 characters.', code: 'VALIDATION' })
      return
    }

    setRegLoading(true)
    try {
      const data = await apiRegister(
        regForm.username.trim(),
        regForm.email.trim().toLowerCase(),
        regForm.password,
        regForm.fullName.trim()
      )
      // data = {user, defaultAccount: {accountNumber, ...}, token}
      setRegSuccess(data)
      saveAuth(data)
      // Brief pause to show success, then navigate
      setTimeout(() => navigate('/accounts', { replace: true }), 1500)
    } catch (err) {
      setRegError(err)
    } finally {
      setRegLoading(false)
    }
  }

  // ── Tab switcher helpers ───────────────────────────────────────────────────
  function switchTab(t) {
    setTab(t)
    setLoginError(null)
    setRegError(null)
    setRegSuccess(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="login-wrapper">
      <div className="login-card">

        {/* Logo / Brand */}
        <div className="login-logo">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true"
               stroke="var(--acc)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
               style={{ display: 'block', margin: '0 auto 12px' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h1>LedgerLine</h1>
          <p>High-integrity financial ledger platform</p>
        </div>

        <div className="card">
          {/* Tab bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn${tab === 'login' ? ' active' : ''}`}
              onClick={() => switchTab('login')}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`tab-btn${tab === 'register' ? ' active' : ''}`}
              onClick={() => switchTab('register')}
              type="button"
            >
              Register
            </button>
          </div>

          {/* ── Login Form ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} noValidate>
              {loginError && (
                <div className="err" role="alert">
                  {loginError.code && <strong>[{loginError.code}]</strong>}{' '}
                  {loginError.message}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  className="form-control"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="e.g. alice"
                  value={loginForm.username}
                  onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  className="form-control"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loginLoading}
                style={{ width: '100%', marginTop: 4 }}
              >
                {loginLoading ? <><span className="spinner" /> Signing in…</> : 'Sign In'}
              </button>

              <p className="form-hint" style={{ textAlign: 'center', marginTop: 12 }}>
                Demo: <strong>alice</strong> / <strong>Password@123</strong>
              </p>
            </form>
          )}

          {/* ── Register Form ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} noValidate>
              {regError && (
                <div className="err" role="alert">
                  {regError.code && <strong>[{regError.code}]</strong>}{' '}
                  {regError.message}
                </div>
              )}

              {regSuccess && (
                <div className="success" role="status">
                  ✓ Account created! Your bank account number is{' '}
                  <strong>{regSuccess.defaultAccount?.accountNumber}</strong>.
                  Redirecting…
                </div>
              )}

              <div className="form-group">
                <label htmlFor="reg-fullname">Full Name <span className="muted text-xs">(optional)</span></label>
                <input
                  id="reg-fullname"
                  className="form-control"
                  type="text"
                  autoComplete="name"
                  placeholder="Your full name"
                  value={regForm.fullName}
                  onChange={e => setRegForm(f => ({ ...f, fullName: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-username">Username <span className="text-dr">*</span></label>
                <input
                  id="reg-username"
                  className="form-control"
                  type="text"
                  autoComplete="username"
                  required
                  minLength={3}
                  placeholder="Choose a username"
                  value={regForm.username}
                  onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email <span className="text-dr">*</span></label>
                <input
                  id="reg-email"
                  className="form-control"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={regForm.email}
                  onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password <span className="text-dr">*</span></label>
                <input
                  id="reg-password"
                  className="form-control"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  value={regForm.password}
                  onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-confirm">Confirm Password <span className="text-dr">*</span></label>
                <input
                  id="reg-confirm"
                  className="form-control"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter password"
                  value={regForm.confirm}
                  onChange={e => setRegForm(f => ({ ...f, confirm: e.target.value }))}
                />
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={regLoading || !!regSuccess}
                style={{ width: '100%', marginTop: 4 }}
              >
                {regLoading ? <><span className="spinner" /> Creating account…</> : 'Create Account'}
              </button>

              <p className="form-hint" style={{ marginTop: 10 }}>
                A checking account is automatically provisioned on registration.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
