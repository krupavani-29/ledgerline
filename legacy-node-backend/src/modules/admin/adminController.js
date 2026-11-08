const config = require('../../config');
const { store } = require('../../db/store');
const { centsToDollars } = require('../transactions/transactionService');

class AdminController {
  async getSystemStats(req, res, next) {
    try {
      const users = store.getUsers();
      const accounts = store.getAccounts();
      const journalEntries = store.getJournalEntries();
      const auditLogs = store.getAuditLogs();

      const totalUserBalanceCents = accounts
        .filter(a => a.id !== config.SYSTEM_RESERVE_ACCOUNT_ID)
        .reduce((sum, a) => sum + a.balance, 0);

      const systemReserve = store.getAccountById(config.SYSTEM_RESERVE_ACCOUNT_ID);

      res.status(200).json({
        success: true,
        data: {
          totalUsers: users.length,
          totalAccounts: accounts.length,
          totalJournalEntries: journalEntries.length,
          totalAuditLogs: auditLogs.length,
          totalUserFundsCents: totalUserBalanceCents,
          totalUserFundsDollars: centsToDollars(totalUserBalanceCents),
          systemReserveBalanceCents: systemReserve ? systemReserve.balance : 0,
          systemReserveBalanceDollars: systemReserve ? centsToDollars(systemReserve.balance) : '0.00',
          accountsByStatus: {
            active: accounts.filter(a => a.status === config.ACCOUNT_STATUS.ACTIVE).length,
            frozen: accounts.filter(a => a.status === config.ACCOUNT_STATUS.FROZEN).length,
            closed: accounts.filter(a => a.status === config.ACCOUNT_STATUS.CLOSED).length
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async updateAccountStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason = 'Administrative action' } = req.body;

      if (!Object.values(config.ACCOUNT_STATUS).includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: `Status must be one of: ${Object.values(config.ACCOUNT_STATUS).join(', ')}` }
        });
      }

      if (id === config.SYSTEM_RESERVE_ACCOUNT_ID) {
        return res.status(400).json({
          success: false,
          error: { code: 'PROTECTED_ACCOUNT', message: 'System reserve account status cannot be altered' }
        });
      }

      let updated;
      await store.transaction(async (tx) => {
        const account = tx.getAccountById(id);
        if (!account) {
          throw new Error('Account not found');
        }

        const oldStatus = account.status;
        updated = tx.updateAccount(id, { status });

        tx.addAuditLog({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: status === config.ACCOUNT_STATUS.FROZEN ? 'ACCOUNT_FROZEN' : 'ACCOUNT_UNFROZEN',
          resourceType: 'ACCOUNT',
          resourceId: id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: {
            accountNumber: account.accountNumber,
            oldStatus,
            newStatus: status,
            reason
          }
        });
      });

      res.status(200).json({
        success: true,
        data: {
          id: updated.id,
          accountNumber: updated.accountNumber,
          status: updated.status,
          updatedAt: updated.updatedAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getUsers(req, res, next) {
    try {
      const users = store.getUsers().map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        createdAt: u.createdAt
      }));

      res.status(200).json({
        success: true,
        data: users
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();

