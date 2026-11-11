import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import AccountsPage from './pages/AccountsPage.jsx'
import TransferPage from './pages/TransferPage.jsx'
import StatementPage from './pages/StatementPage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/accounts" replace />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="transfer" element={<TransferPage />} />
          <Route path="statement" element={<StatementPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

