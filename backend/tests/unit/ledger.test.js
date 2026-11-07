const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { Store } = require('../../src/db/store');
const ledgerService = require('../../src/modules/ledger/ledgerService');
const config = require('../../src/config');

test('Double-Entry Ledger Unit Tests', async (t) => {
  const testDbPath = path.resolve(__dirname, `../temp_ledger_test_${Date.now()}.json`);
  const testStore = new Store(testDbPath);

  t.after(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  await test.test('rejects transaction with fewer than two legs', async () => {
    await assert.rejects(async () => {
      await testStore.transaction(async (tx) => {
        ledgerService.recordTransaction(tx, {
          entryType: 'TRANSFER',
          description: 'Invalid single leg',
          legs: [
            { accountId: 'acc-1', direction: config.ENTRY_DIRECTION.DEBIT, amount: 100 }
          ]
        });
      });
    }, /must contain at least two posting legs/);
  });

  await test.test('rejects unbalanced journal entry (Debits != Credits)', async () => {
    await assert.rejects(async () => {
      await testStore.transaction(async (tx) => {
        tx.addAccount({ id: 'acc-1', accountNumber: 'LL-1', balance: 1000, status: config.ACCOUNT_STATUS.ACTIVE });
        tx.addAccount({ id: 'acc-2', accountNumber: 'LL-2', balance: 1000, status: config.ACCOUNT_STATUS.ACTIVE });

        ledgerService.recordTransaction(tx, {
          entryType: 'TRANSFER',
          description: 'Unbalanced transfer',
          legs: [
            { accountId: 'acc-1', direction: config.ENTRY_DIRECTION.DEBIT, amount: 500 },
            { accountId: 'acc-2', direction: config.ENTRY_DIRECTION.CREDIT, amount: 300 }
          ]
        });
      });
    }, /Double-Entry Invariant Failure/);
  });

  await test.test('rejects zero or negative transaction amounts', async () => {
    await assert.rejects(async () => {
      await testStore.transaction(async (tx) => {
        tx.addAccount({ id: 'acc-a', accountNumber: 'LL-A', balance: 1000, status: config.ACCOUNT_STATUS.ACTIVE });
        tx.addAccount({ id: 'acc-b', accountNumber: 'LL-B', balance: 1000, status: config.ACCOUNT_STATUS.ACTIVE });

        ledgerService.recordTransaction(tx, {
          entryType: 'TRANSFER',
          description: 'Zero amount transfer',
          legs: [
            { accountId: 'acc-a', direction: config.ENTRY_DIRECTION.DEBIT, amount: 0 },
            { accountId: 'acc-b', direction: config.ENTRY_DIRECTION.CREDIT, amount: 0 }
          ]
        });
      });
    }, /Amount must be a positive integer in cents/);

    await assert.rejects(async () => {
      await testStore.transaction(async (tx) => {
        ledgerService.recordTransaction(tx, {
          entryType: 'TRANSFER',
          description: 'Negative amount transfer',
          legs: [
            { accountId: 'acc-a', direction: config.ENTRY_DIRECTION.DEBIT, amount: -100 },
            { accountId: 'acc-b', direction: config.ENTRY_DIRECTION.CREDIT, amount: -100 }
          ]
        });
      });
    }, /Amount must be a positive integer in cents/);
  });

  await test.test('strictly prevents negative balance / overdraft', async () => {
    await assert.rejects(async () => {
      await testStore.transaction(async (tx) => {
        tx.addAccount({ id: 'acc-broke', accountNumber: 'LL-BROKE', balance: 50, status: config.ACCOUNT_STATUS.ACTIVE });
        tx.addAccount({ id: 'acc-rich', accountNumber: 'LL-RICH', balance: 5000, status: config.ACCOUNT_STATUS.ACTIVE });

        ledgerService.recordTransaction(tx, {
          entryType: 'TRANSFER',
          description: 'Attempted overdraft',
          legs: [
            { accountId: 'acc-broke', direction: config.ENTRY_DIRECTION.DEBIT, amount: 100 },
            { accountId: 'acc-rich', direction: config.ENTRY_DIRECTION.CREDIT, amount: 100 }
          ]
        });
      });
    }, /Insufficient funds/);
  });

  await test.test('successfully executes balanced transfer and maintains conservation', async () => {
    await testStore.transaction(async (tx) => {
      const acc1 = tx.addAccount({
        id: 'acc-user1',
        accountNumber: 'LL-U1',
        accountType: config.ACCOUNT_TYPES.USER_CHECKING,
        balance: 1000,
        status: config.ACCOUNT_STATUS.ACTIVE
      });
      const acc2 = tx.addAccount({
        id: 'acc-user2',
        accountNumber: 'LL-U2',
        accountType: config.ACCOUNT_TYPES.USER_CHECKING,
        balance: 500,
        status: config.ACCOUNT_STATUS.ACTIVE
      });

      const { journalEntry, legs } = ledgerService.recordTransaction(tx, {
        entryType: config.TRANSACTION_TYPES.TRANSFER,
        description: 'Valid $2.00 transfer',
        legs: [
          { accountId: acc1.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: 200 },
          { accountId: acc2.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: 200 }
        ]
      });

      assert.equal(journalEntry.status, 'POSTED');
      assert.equal(legs.length, 2);
      assert.equal(tx.getAccountById('acc-user1').balance, 800);
      assert.equal(tx.getAccountById('acc-user2').balance, 700);
    });

    const check = ledgerService.verifyConservation(testStore);
    assert.equal(check.systemConservation.differenceCents, 0);
  });
});

