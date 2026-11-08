const crypto = require('crypto');
const config = require('../../config');

class LedgerService {
  /**
   * Records a strictly balanced double-entry transaction.
   * Every transaction must have at least 2 legs, where sum(debits) === sum(credits).
   */
  recordTransaction(txContext, {
    entryType,
    description,
    legs, // Array of { accountId, direction: 'DEBIT' | 'CREDIT', amount: integerCents }
    metadata = {}
  }) {
    if (!legs || legs.length < 2) {
      throw new Error('A double-entry transaction must contain at least two posting legs');
    }

    let totalDebits = 0;
    let totalCredits = 0;

    // Validate each leg
    for (const leg of legs) {
      if (!leg.accountId) throw new Error('Posting leg must specify an accountId');
      if (!Number.isInteger(leg.amount) || leg.amount <= 0) {
        throw new Error(`Invalid leg amount: ${leg.amount}. Amount must be a positive integer in cents.`);
      }

      if (leg.direction === config.ENTRY_DIRECTION.DEBIT) {
        totalDebits += leg.amount;
      } else if (leg.direction === config.ENTRY_DIRECTION.CREDIT) {
        totalCredits += leg.amount;
      } else {
        throw new Error(`Invalid posting direction: ${leg.direction}`);
      }

      const account = txContext.getAccountById(leg.accountId);
      if (!account) {
        throw new Error(`Account ${leg.accountId} does not exist`);
      }
      if (account.status !== config.ACCOUNT_STATUS.ACTIVE) {
        throw new Error(`Account ${account.accountNumber} is ${account.status}. Transactions cannot be processed.`);
      }
    }

    // Invariant: Debits must strictly equal Credits
    if (totalDebits !== totalCredits) {
      throw new Error(`Double-Entry Invariant Failure: Debits (${totalDebits}) do not equal Credits (${totalCredits})`);
    }

    const journalEntryId = `je-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const journalEntry = {
      id: journalEntryId,
      entryType,
      description,
      amount: totalDebits,
      currency: config.CURRENCY,
      status: 'POSTED',
      createdAt: timestamp,
      metadata
    };

    txContext.addJournalEntry(journalEntry);

    const createdLegs = [];

    // Apply posting legs to accounts
    for (const leg of legs) {
      const account = txContext.getAccountById(leg.accountId);
      
      // Standard banking double-entry accounting:
      // - For Asset accounts (SYSTEM_RESERVE): DEBIT increases cash, CREDIT decreases cash.
      // - For Liability accounts (Customer Checking/Savings): CREDIT increases deposit liability, DEBIT decreases deposit liability.
      let balanceChange = 0;
      if (account.accountType === config.ACCOUNT_TYPES.SYSTEM_RESERVE) {
        balanceChange = (leg.direction === config.ENTRY_DIRECTION.DEBIT) ? leg.amount : -leg.amount;
      } else {
        balanceChange = (leg.direction === config.ENTRY_DIRECTION.CREDIT) ? leg.amount : -leg.amount;
      }

      const newBalance = account.balance + balanceChange;
      if (newBalance < 0) {
        throw new Error(`Insufficient funds: Account ${account.accountNumber} balance (${account.balance} cents) cannot cover debit of ${leg.amount} cents`);
      }

      txContext.updateAccount(account.id, { balance: newBalance });

      const postingLeg = {
        id: `leg-${crypto.randomUUID()}`,
        journalEntryId,
        accountId: account.id,
        direction: leg.direction,
        amount: leg.amount,
        runningBalance: newBalance,
        createdAt: timestamp
      };

      txContext.addPostingLeg(postingLeg);
      createdLegs.push(postingLeg);
    }

    return {
      journalEntry,
      legs: createdLegs
    };
  }

  /**
   * Verifies the mathematical integrity and money conservation across the entire ledger.
   */
  verifyConservation(store) {
    const journalEntries = store.getJournalEntries();
    const postingLegs = store.getPostingLegs();
    const accounts = store.getAccounts();

    let totalSystemDebits = 0;
    let totalSystemCredits = 0;
    const errors = [];

    // 1. Check each journal entry balances
    const legsByEntry = {};
    for (const leg of postingLegs) {
      if (!legsByEntry[leg.journalEntryId]) {
        legsByEntry[leg.journalEntryId] = { debits: 0, credits: 0, count: 0 };
      }
      legsByEntry[leg.journalEntryId].count++;
      if (leg.direction === config.ENTRY_DIRECTION.DEBIT) {
        legsByEntry[leg.journalEntryId].debits += leg.amount;
        totalSystemDebits += leg.amount;
      } else if (leg.direction === config.ENTRY_DIRECTION.CREDIT) {
        legsByEntry[leg.journalEntryId].credits += leg.amount;
        totalSystemCredits += leg.amount;
      }
    }

    for (const je of journalEntries) {
      const sums = legsByEntry[je.id] || { debits: 0, credits: 0, count: 0 };
      if (sums.count < 2) {
        errors.push(`Journal Entry ${je.id} has fewer than 2 posting legs (${sums.count})`);
      }
      if (sums.debits !== sums.credits) {
        errors.push(`Journal Entry ${je.id} unbalanced: Debits ${sums.debits} != Credits ${sums.credits}`);
      }
      if (sums.debits !== je.amount) {
        errors.push(`Journal Entry ${je.id} amount mismatch: Entry recorded ${je.amount}, legs sum to ${sums.debits}`);
      }
    }

    // 2. Reconcile account balances against ledger legs
    const accountBalanceFromLegs = {};
    for (const acc of accounts) {
      accountBalanceFromLegs[acc.id] = 0;
    }

    for (const leg of postingLegs) {
      if (accountBalanceFromLegs[leg.accountId] !== undefined) {
        const acc = accounts.find(a => a.id === leg.accountId);
        if (acc && acc.accountType === config.ACCOUNT_TYPES.SYSTEM_RESERVE) {
          accountBalanceFromLegs[leg.accountId] += (leg.direction === config.ENTRY_DIRECTION.DEBIT ? leg.amount : -leg.amount);
        } else {
          accountBalanceFromLegs[leg.accountId] += (leg.direction === config.ENTRY_DIRECTION.CREDIT ? leg.amount : -leg.amount);
        }
      }
    }

    const accountReconciliation = [];
    for (const acc of accounts) {
      const calculated = accountBalanceFromLegs[acc.id] || 0;
      const isMatch = calculated === acc.balance;
      if (!isMatch) {
        errors.push(`Account ${acc.accountNumber} balance mismatch: Stored=${acc.balance}, CalculatedFromLegs=${calculated}`);
      }
      if (acc.balance < 0) {
        errors.push(`Account ${acc.accountNumber} has negative balance: ${acc.balance}`);
      }
      accountReconciliation.push({
        accountId: acc.id,
        accountNumber: acc.accountNumber,
        storedBalance: acc.balance,
        calculatedBalance: calculated,
        matched: isMatch
      });
    }

    // 3. System-wide conservation: Total debits must equal total credits
    const systemBalanced = (totalSystemDebits === totalSystemCredits);
    if (!systemBalanced) {
      errors.push(`Global Conservation Broken: Total Debits (${totalSystemDebits}) != Total Credits (${totalSystemCredits})`);
    }

    return {
      isBalanced: errors.length === 0,
      systemConservation: {
        totalDebitsCents: totalSystemDebits,
        totalCreditsCents: totalSystemCredits,
        differenceCents: Math.abs(totalSystemDebits - totalSystemCredits)
      },
      accountsAudited: accounts.length,
      journalEntriesAudited: journalEntries.length,
      postingLegsAudited: postingLegs.length,
      errors,
      accountReconciliation
    };
  }
}

module.exports = new LedgerService();
