@echo off
REM =============================================================================
REM BalanceVault / LedgerLine: First Administrator Bootstrap Script (Windows)
REM =============================================================================

set BACKEND_URL=%1
if "%BACKEND_URL%"=="" set BACKEND_URL=http://localhost:8080

set BOOTSTRAP_SECRET=%2
if "%BOOTSTRAP_SECRET%"=="" set BOOTSTRAP_SECRET=balancevault-bootstrap-secret

set ADMIN_USER=%3
if "%ADMIN_USER%"=="" set ADMIN_USER=admin

set ADMIN_PASS=%4
if "%ADMIN_PASS%"=="" set ADMIN_PASS=Password@123

echo [*] Bootstrapping First Administrator on %BACKEND_URL%...

curl -s -X POST "%BACKEND_URL%/api/auth/bootstrap-admin" ^
  -H "Content-Type: application/json" ^
  -d "{\"bootstrapSecret\": \"%BOOTSTRAP_SECRET%\", \"username\": \"%ADMIN_USER%\", \"password\": \"%ADMIN_PASS%\", \"fullName\": \"System Administrator\"}"

echo.
echo [*] Bootstrap request complete.

