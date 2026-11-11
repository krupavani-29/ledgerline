import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearAuth, getUsername, getFullName, getRole, isAdmin, isAuditorOrAdmin } from '../lib/auth.js'

/**
 * Root layout component.
 * Renders the sticky navigation header and the page content via <Outlet />.
 * Navigation links are conditionally rendered based on the user's role.
 */
export default function Layout() {
  const navigate  = useNavigate()
  const username  = getUsername()
  const fullName  = getFullName()
  const role      = getRole()
  const displayName = fullName || username

  function handleLogout() {
    clearAuth()
    navigate('/login', { replace: true })
  }

  /**
   * Build a NavLink className — applies "active" when the route is current.
   * React Router v6 provides the `isActive` boolean via the className callback.
   */
  const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

  return (
    <>
      {/* ── Sticky Navigation Bar ── */}
      <nav className="nav-bar" role="navigation" aria-label="Main navigation">
        <div className="nav-inner">
          {/* Brand */}
          <span className="nav-brand">
            {/* Ledger icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                 stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            LedgerLine
          </span>

          {/* Navigation links */}
          <div className="nav-links">
            <NavLink to="/accounts"  className={navClass}>Accounts</NavLink>
            <NavLink to="/transfer"  className={navClass}>Transfer</NavLink>
            <NavLink to="/statement" className={navClass}>Statement</NavLink>
            {isAuditorOrAdmin() && (
              <NavLink to="/audit" className={navClass}>Audit</NavLink>
            )}
            {isAdmin() && (
              <NavLink to="/admin" className={navClass}>Admin</NavLink>
            )}
          </div>

          {/* User identity + logout */}
          <div className="nav-user">
            <div className="user-badge" aria-label={`Signed in as ${displayName}`}>
              <span className="user-name">{displayName}</span>
              {role && <span className="role-pill">{role.replace('_', ' ')}</span>}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Page Content ── */}
      <main className="page-wrapper" id="main-content">
        <Outlet />
      </main>
    </>
  )
}
