const crypto = require('crypto');
const config = require('../../config');
const ledgerService = require('../ledger/ledgerService');

// Helper to convert dollars (e.g. 10.50) to integer cents (1050)
function parseDollarsToCents(amount) {
  if (amount === undefined || amount === null) {
    throw new Error('Amount is required');
  }
  const parsed = Number(amount);
  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    throw new Error('Amount must be a positive number greater than 0');
  }
  // Max transaction guard: e.g. $10,000,000 to prevent integer overflow
  if (parsed > 10000000) {
    throw new Error('Transaction amount exceeds maximum allowed limit ($10,000,000)');
  }
  // Convert to cents with exact rounding
  const cents = Math.round(parsed * 100);
  if (cents <= 0) {
    throw new Error('Amount in cents must be at least 1 cent');
  }
  return cents;
}

function centsToDollars(cents) {
  return (cents / 100).toFixed(2);
}

class TransactionService {
  /**
   * Deposit money into an account.
   * Double-entry: Debit SYSTEM_RESERVE, Credit USER_ACCOUNT.
   */
  async deposit(store, {
    userId,
    userRole,
    accountId,
    amount,
    description = 'Account Deposit',
    ip = '127.0.0.1',
    userAgent = 'unknown'
  }) {
    const amountCents = parseDollarsToCents(amount);

    return await store.withLock([accountId, config.SYSTEM_RESERVE_ACCOUNT_ID], async () => {
      return await store.transaction(async (tx) => {
        const account = tx.getAccountById(accountId);
        if (!account) {
          throw new Error('Account not found');
        }

        // Ownership check: Users can only deposit into their own accounts (unless ADMIN)
        if (userRole !== config.ROLES.ADMIN && account.userId !== userId) {
          tx.addAuditLog({
            actorId: userId,
            actorRole: userRole,
            action: 'SECURITY_IDOR_BLOCKED',
            resourceType: 'ACCOUNT',
            resourceId: accountId,
            ipAddress: ip,
            userAgent,
            details: { attemptedAction: 'DEPOSIT', targetOwner: account.userId }
          });
          const err = new Error('Access denied: You do not have permission to deposit into this account');
          err.statusCode = 403;
          throw err;
        }

        if (account.status !== config.ACCOUNT_STATUS.ACTIVE) {
          const err = new Error(`Account is ${account.status}. Deposits cannot be processed.`);
          err.statusCode = 400;
          throw err;
        }

        const systemReserve = tx.getAccountById(config.SYSTEM_RESERVE_ACCOUNT_ID);
        if (!systemReserve) {
          throw new Error('System settlement account is not configured');
        }

        const { journalEntry, legs } = ledgerService.recordTransaction(tx, {
          entryType: config.TRANSACTION_TYPES.DEPOSIT,
          description: description || `Deposit to ${account.accountNumber}`,
          legs: [
            { accountId: systemReserve.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: amountCents },
            { accountId: account.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: amountCents }
          ],
          metadata: { userId, accountId, ip }
        });

        const refreshedAccount = tx.getAccountById(accountId);

        tx.addAuditLog({
          actorId: userId,
          actorRole: userRole,
          action: 'DEPOSIT_EXECUTED',
          resourceType: 'TRANSACTION',
          resourceId: journalEntry.id,
          ipAddress: ip,
          userAgent,
          details: {
            accountId,
            accountNumber: account.accountNumber,
            amountCents,
            amountDollars: centsToDollars(amountCents),
            newBalanceCents: refreshedAccount.balance,
            newBalanceDollars: centsToDollars(refreshedAccount.balance)
          }
        });

        return {
          transactionId: journalEntry.id,
          type: config.TRANSACTION_TYPES.DEPOSIT,
          amountCents,
          amountDollars: centsToDollars(amountCents),
          accountNumber: account.accountNumber,
          balanceCents: refreshedAccount.balance,
          balanceDollars: centsToDollars(refreshedAccount.balance),
          timestamp: journalEntry.createdAt,
          legs
        };
      });
    });
  }

  /**
   * Withdraw money from an account.
   * Double-entry: Debit USER_ACCOUNT, Credit SYSTEM_RESERVE.
   */
  async withdraw(store, {
    userId,
    userRole,
    accountId,
    amount,
    description = 'Account Withdrawal',
    ip = '127.0.0.1',
    userAgent = 'unknown'
  }) {
    const amountCents = parseDollarsToCents(amount);

    return await store.withLock([accountId, config.SYSTEM_RESERVE_ACCOUNT_ID], async () => {
      return await store.transaction(async (tx) => {
        const account = tx.getAccountById(accountId);
        if (!account) {
          throw new Error('Account not found');
        }

        // Strict Ownership verification (Anti-IDOR)
        if (userRole !== config.ROLES.ADMIN && account.userId !== userId) {
          tx.addAuditLog({
            actorId: userId,
            actorRole: userRole,
            action: 'SECURITY_IDOR_BLOCKED',
            resourceType: 'ACCOUNT',
            resourceId: accountId,
            ipAddress: ip,
            userAgent,
            details: { attemptedAction: 'WITHDRAW', targetOwner: account.userId }
          });
          const err = new Error('Access denied: You cannot withdraw from an account you do not own');
          err.statusCode = 403;
          throw err;
        }

        if (account.status !== config.ACCOUNT_STATUS.ACTIVE) {
          const err = new Error(`Account is ${account.status}. Withdrawals cannot be processed.`);
          err.statusCode = 400;
          throw err;
        }

        // Strict Server-Side Balance Check under Lock
        if (account.balance < amountCents) {
          const err = new Error(`Insufficient funds: Available balance is $${centsToDollars(account.balance)}, requested $${centsToDollars(amountCents)}`);
          err.statusCode = 400;
          throw err;
        }

        const systemReserve = tx.getAccountById(config.SYSTEM_RESERVE_ACCOUNT_ID);

        const { journalEntry, legs } = ledgerService.recordTransaction(tx, {
          entryType: config.TRANSACTION_TYPES.WITHDRAWAL,
          description: description || `Withdrawal from ${account.accountNumber}`,
          legs: [
            { accountId: account.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: amountCents },
            { accountId: systemReserve.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: amountCents }
          ],
          metadata: { userId, accountId, ip }
        });

        const refreshedAccount = tx.getAccountById(accountId);

        tx.addAuditLog({
          actorId: userId,
          actorRole: userRole,
          action: 'WITHDRAWAL_EXECUTED',
          resourceType: 'TRANSACTION',
          resourceId: journalEntry.id,
          ipAddress: ip,
          userAgent,
          details: {
            accountId,
            accountNumber: account.accountNumber,
            amountCents,
            amountDollars: centsToDollars(amountCents),
            newBalanceCents: refreshedAccount.balance,
            newBalanceDollars: centsToDollars(refreshedAccount.balance)
          }
        });

        return {
          transactionId: journalEntry.id,
          type: config.TRANSACTION_TYPES.WITHDRAWAL,
          amountCents,
          amountDollars: centsToDollars(amountCents),
          accountNumber: account.accountNumber,
          balanceCents: refreshedAccount.balance,
          balanceDollars: centsToDollars(refreshedAccount.balance),
          timestamp: journalEntry.createdAt,
          legs
        };
      });
    });
  }

  /**
   * Transfer money between two accounts.
   * Double-entry: Debit SOURCE_ACCOUNT, Credit DESTINATION_ACCOUNT.
   */
  async transfer(store, {
    userId,
    userRole,
    sourceAccountId,
    destinationAccountNumber,
    amount,
    description = 'Account Transfer',
    ip = '127.0.0.1',
    userAgent = 'unknown'
  }) {
    const amountCents = parseDollarsToCents(amount);

    if (!sourceAccountId) {
      throw new Error('Source account ID is required');
    }
    if (!destinationAccountNumber) {
      throw new Error('Destination account number is required');
    }

    // Pre-lookup destination account to get its ID for deadlock-free locking
    const destinationAccount = store.getAccountByNumber(destinationAccountNumber.trim());
    if (!destinationAccount) {
      const err = new Error(`Destination account "${destinationAccountNumber}" does not exist`);
      err.statusCode = 404;
      throw err;
    }

    if (sourceAccountId === destinationAccount.id) {
      const err = new Error('Cannot transfer money to the same account');
      err.statusCode = 400;
      throw err;
    }

    // Acquire pessimistic lock on BOTH accounts in sorted order
    return await store.withLock([sourceAccountId, destinationAccount.id], async () => {
      return await store.transaction(async (tx) => {
        const sourceAccount = tx.getAccountById(sourceAccountId);
        if (!sourceAccount) {
          throw new Error('Source account not found');
        }

        // Strict Ownership verification (Anti-IDOR)
        if (userRole !== config.ROLES.ADMIN && sourceAccount.userId !== userId) {
          tx.addAuditLog({
            actorId: userId,
            actorRole: userRole,
            action: 'SECURITY_IDOR_BLOCKED',
            resourceType: 'ACCOUNT',
            resourceId: sourceAccountId,
            ipAddress: ip,
            userAgent,
            details: {
              attemptedAction: 'TRANSFER',
              sourceAccountOwner: sourceAccount.userId,
              targetAccount: destinationAccountNumber
            }
          });
          const err = new Error('Access denied: You cannot transfer funds from an account you do not own');
          err.statusCode = 403;
          throw err;
        }

        if (sourceAccount.status !== config.ACCOUNT_STATUS.ACTIVE) {
          const err = new Error(`Source account is ${sourceAccount.status}. Transfers cannot be processed.`);
          err.statusCode = 400;
          throw err;
        }

        const freshDestAccount = tx.getAccountById(destinationAccount.id);
        if (freshDestAccount.status !== config.ACCOUNT_STATUS.ACTIVE) {
          const err = new Error(`Destination account is ${freshDestAccount.status}. Transfers cannot be received.`);
          err.statusCode = 400;
          throw err;
        }

        // Strict Server-Side Balance Check under Lock
        if (sourceAccount.balance < amountCents) {
          const err = new Error(`Insufficient funds: Source balance is $${centsToDollars(sourceAccount.balance)}, transfer amount is $${centsToDollars(amountCents)}`);
          err.statusCode = 400;
          throw err;
        }

        // Execute Balanced Double-Entry Movement
        const { journalEntry, legs } = ledgerService.recordTransaction(tx, {
          entryType: config.TRANSACTION_TYPES.TRANSFER,
          description: description || `Transfer from ${sourceAccount.accountNumber} to ${freshDestAccount.accountNumber}`,
          legs: [
            { accountId: sourceAccount.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: amountCents },
            { accountId: freshDestAccount.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: amountCents }
          ],
          metadata: {
            userId,
            fromAccount: sourceAccount.accountNumber,
            toAccount: freshDestAccount.accountNumber,
            ip
          }
        });

        const refreshedSource = tx.getAccountById(sourceAccountId);
        const refreshedDest = tx.getAccountById(freshDestAccount.id);

        tx.addAuditLog({
          actorId: userId,
          actorRole: userRole,
          action: 'TRANSFER_EXECUTED',
          resourceType: 'TRANSACTION',
          resourceId: journalEntry.id,
          ipAddress: ip,
          userAgent,
          details: {
            fromAccount: sourceAccount.accountNumber,
            toAccount: freshDestAccount.accountNumber,
            amountCents,
            amountDollars: centsToDollars(amountCents),
            sourceRemainingBalanceCents: refreshedSource.balance,
            sourceRemainingBalanceDollars: centsToDollars(refreshedSource.balance)
          }
        });

        return {
          transactionId: journalEntry.id,
          type: config.TRANSACTION_TYPES.TRANSFER,
          amountCents,
          amountDollars: centsToDollars(amountCents),
          fromAccount: sourceAccount.accountNumber,
          toAccount: freshDestAccount.accountNumber,
          sourceBalanceCents: refreshedSource.balance,
          sourceBalanceDollars: centsToDollars(refreshedSource.balance),
          timestamp: journalEntry.createdAt,
          legs
        };
      });
    });
  }
}

module.exports = {
  TransactionService: new TransactionService(),
  parseDollarsToCents,
  centsToDollars
};
