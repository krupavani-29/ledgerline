const crypto = require('crypto');
const config = require('../../config');
const { store } = require('../../db/store');
const { centsToDollars } = require('../transactions/transactionService');

class AccountController {
  async createAccount(req, res, next) {
    try {
      const { accountType = config.ACCOUNT_TYPES.USER_SAVINGS } = req.body;
      const userId = req.user.id;

      if (![config.ACCOUNT_TYPES.USER_CHECKING, config.ACCOUNT_TYPES.USER_SAVINGS].includes(accountType)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACCOUNT_TYPE', message: 'Account type must be USER_CHECKING or USER_SAVINGS' }
        });
      }

      const accountId = `acc-${crypto.randomUUID()}`;
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const accountNumber = `LL-ACC-${randomSuffix}`;

      let account;
      await store.transaction(async (tx) => {
        account = {
          id: accountId,
          userId,
          accountNumber,
          accountType,
          currency: config.CURRENCY,
          balance: 0,
          status: config.ACCOUNT_STATUS.ACTIVE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        tx.addAccount(account);

        tx.addAuditLog({
          actorId: userId,
          actorRole: req.user.role,
          action: 'ACCOUNT_CREATED',
          resourceType: 'ACCOUNT',
          resourceId: accountId,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: { accountNumber, accountType }
        });
      });

      res.status(201).json({
        success: true,
        data: {
          id: account.id,
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          balanceCents: account.balance,
          balanceDollars: centsToDollars(account.balance),
          status: account.status,
          currency: account.currency,
          createdAt: account.createdAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getAccounts(req, res, next) {
    try {
      const { role, id: userId } = req.user;

      let accounts;
      if (role === config.ROLES.AUDITOR || role === config.ROLES.ADMIN) {
        // Auditors and Admins can view all accounts
        accounts = store.getAccounts();
      } else {
        // Account holders can strictly ONLY view their own accounts
        accounts = store.getAccountsByUserId(userId);
      }

      const formatted = accounts.map(acc => {
        const owner = store.getUserById(acc.userId);
        return {
          id: acc.id,
          userId: acc.userId,
          ownerName: owner ? (owner.fullName || owner.username) : 'System',
          accountNumber: acc.accountNumber,
          accountType: acc.accountType,
          balanceCents: acc.balance,
          balanceDollars: centsToDollars(acc.balance),
          status: acc.status,
          currency: acc.currency,
          createdAt: acc.createdAt,
          updatedAt: acc.updatedAt
        };
      });

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  async getAccountById(req, res, next) {
    try {
      const { id } = req.params;
      const account = store.getAccountById(id);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }
        });
      }

      // Strict Object-Level Authorization (Anti-IDOR)
      if (req.user.role === config.ROLES.ACCOUNT_HOLDER && account.userId !== req.user.id) {
        // Log IDOR attempt to audit trail
        store.transaction(async (tx) => {
          tx.addAuditLog({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'SECURITY_IDOR_BLOCKED',
            resourceType: 'ACCOUNT',
            resourceId: id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'unknown',
            details: { attemptedAction: 'GET_ACCOUNT_BY_ID', targetOwner: account.userId }
          });
        }).catch(err => console.error(err));

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_IDOR',
            message: 'Access denied: You do not have permission to view this account'
          }
        });
      }

      const owner = store.getUserById(account.userId);

      res.status(200).json({
        success: true,
        data: {
          id: account.id,
          userId: account.userId,
          ownerName: owner ? (owner.fullName || owner.username) : 'System',
          accountNumber: account.accountNumber,
          accountType: account.accountType,
          balanceCents: account.balance,
          balanceDollars: centsToDollars(account.balance),
          status: account.status,
          currency: account.currency,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getAccountStatement(req, res, next) {
    try {
      const { id } = req.params;
      const account = store.getAccountById(id);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' }
        });
      }

      // Strict Object-Level Authorization (Anti-IDOR)
      if (req.user.role === config.ROLES.ACCOUNT_HOLDER && account.userId !== req.user.id) {
        store.transaction(async (tx) => {
          tx.addAuditLog({
            actorId: req.user.id,
            actorRole: req.user.role,
            action: 'SECURITY_IDOR_BLOCKED',
            resourceType: 'ACCOUNT',
            resourceId: id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'unknown',
            details: { attemptedAction: 'GET_STATEMENT', targetOwner: account.userId }
          });
        }).catch(err => console.error(err));

        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_IDOR',
            message: 'Access denied: You do not have permission to view statements for this account'
          }
        });
      }

      // Fetch posting legs for this account
      const legs = store.getPostingLegsForAccount(id);
      const journalEntries = store.getJournalEntries();
      const jeMap = new Map(journalEntries.map(j => [j.id, j]));

      const statementEntries = legs.map(leg => {
        const je = jeMap.get(leg.journalEntryId) || {};
        return {
          legId: leg.id,
          journalEntryId: leg.journalEntryId,
          type: je.entryType || 'UNKNOWN',
          description: je.description || '',
          direction: leg.direction,
          amountCents: leg.amount,
          amountDollars: centsToDollars(leg.amount),
          runningBalanceCents: leg.runningBalance,
          runningBalanceDollars: centsToDollars(leg.runningBalance),
          timestamp: leg.createdAt
        };
      });

      res.status(200).json({
        success: true,
        data: {
          accountId: account.id,
          accountNumber: account.accountNumber,
          currentBalanceCents: account.balance,
          currentBalanceDollars: centsToDollars(account.balance),
          totalTransactions: statementEntries.length,
          statement: statementEntries.reverse() // Newest first
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AccountController();

