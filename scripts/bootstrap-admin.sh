#!/usr/bin/env bash
# =============================================================================
# BalanceVault / LedgerLine: First Administrator Bootstrap Script (Unix / Linux)
# =============================================================================

BACKEND_URL="${1:-http://localhost:8080}"
BOOTSTRAP_SECRET="${2:-balancevault-bootstrap-secret}"
ADMIN_USER="${3:-admin}"
ADMIN_PASS="${4:-Password@123}"

echo "[*] Bootstrapping First Administrator on ${BACKEND_URL}..."

curl -s -X POST "${BACKEND_URL}/api/auth/bootstrap-admin" \
  -H "Content-Type: application/json" \
  -d "{\"bootstrapSecret\": \"${BOOTSTRAP_SECRET}\", \"username\": \"${ADMIN_USER}\", \"password\": \"${ADMIN_PASS}\", \"fullName\": \"System Administrator\"}"

echo ""
echo "[*] Bootstrap request complete."

