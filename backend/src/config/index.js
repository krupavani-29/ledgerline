require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'ledgerline-super-secure-production-secret-key-32bytes-minimum',
  JWT_EXPIRES_IN: '24h',
  DATA_DIR: path.resolve(process.env.DATA_DIR || './data'),
  DB_FILE: path.resolve(process.env.DB_FILE || './data/ledgerline.json'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // System Roles
  ROLES: {
    ADMIN: 'ADMIN',
    ACCOUNT_HOLDER: 'ACCOUNT_HOLDER',
    AUDITOR: 'AUDITOR'
  },

  // Account Statuses
  ACCOUNT_STATUS: {
    ACTIVE: 'ACTIVE',
    FROZEN: 'FROZEN',
    CLOSED: 'CLOSED'
  },

  // Account Types
  ACCOUNT_TYPES: {
    USER_CHECKING: 'USER_CHECKING',
    USER_SAVINGS: 'USER_SAVINGS',
    SYSTEM_RESERVE: 'SYSTEM_RESERVE',
    SYSTEM_EQUITY: 'SYSTEM_EQUITY'
  },

  // System Accounts
  SYSTEM_RESERVE_ACCOUNT_ID: 'acc-sys-reserve-0001',
  SYSTEM_RESERVE_ACCOUNT_NUMBER: 'LL-SYS-000001',
  SYSTEM_EQUITY_ACCOUNT_ID: 'acc-sys-equity-0001',
  SYSTEM_EQUITY_ACCOUNT_NUMBER: 'LL-SYS-EQUITY',

  // Currency
  CURRENCY: 'USD',
  
  // Supported Transaction Types
  TRANSACTION_TYPES: {
    DEPOSIT: 'DEPOSIT',
    WITHDRAWAL: 'WITHDRAWAL',
    TRANSFER: 'TRANSFER'
  },

  // Journal Posting Direction
  ENTRY_DIRECTION: {
    DEBIT: 'DEBIT',
    CREDIT: 'CREDIT'
  }
};
