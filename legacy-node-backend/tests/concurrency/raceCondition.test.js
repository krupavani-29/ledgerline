const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');
const { store } = require('../../src/db/store');
const { seedDatabase } = require('../../src/db/seed');
const ledgerService = require('../../src/modules/ledger/ledgerService');

test('High-Concurrency Race Condition & Double-Spend Prevention Tests', async (t) => {
  let aliceToken, bobToken;
  let aliceAccount, bobAccount;

  t.before(async () => {
    await seedDatabase(store);

    const resAlice = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Password@123' });
    aliceToken = resAlice.body.data.token;

    const resBob = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'Password@123' });
    bobToken = resBob.body.data.token;

    // Create an isolated account for Alice with exactly $100.00
    const resNewAcc = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ accountType: 'USER_CHECKING' });
    aliceAccount = resNewAcc.body.data;

    // Fund it with exactly $100.00
    await request(app)
      .post('/api/transactions/deposit')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', `seed-fund-${Date.now()}`)
      .send({ accountId: aliceAccount.id, amount: 100.00 });

    bobAccount = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-200001');
  });

  await test.test('Double-Spending Race: 15 concurrent withdrawals against $100 balance allows exactly 1 to succeed', async () => {
    const freshAccount = store.getAccountById(aliceAccount.id);
    assert.equal(freshAccount.balance, 10000, 'Initial balance must be exactly $100.00 (10000 cents)');

    const CONCURRENCY_COUNT = 15;
    const withdrawalPromises = [];

    // Fire 15 simultaneous requests attempting to withdraw $100 each
    for (let i = 0; i < CONCURRENCY_COUNT; i++) {
      const uniqueKey = `race-withdraw-${i}-${Date.now()}`;
      withdrawalPromises.push(
        request(app)
          .post('/api/transactions/withdraw')
          .set('Authorization', `Bearer ${aliceToken}`)
          .set('Idempotency-Key', uniqueKey)
          .send({
            accountId: aliceAccount.id,
            amount: 100.00,
            description: `Concurrent attack attempt #${i}`
          })
      );
    }

    const results = await Promise.all(withdrawalPromises);

    const successful = results.filter(r => r.status === 200);
    const rejected = results.filter(r => r.status === 400);

    // Exactly 1 must win the lock and withdraw $100
    assert.equal(successful.length, 1, `Expected exactly 1 withdrawal to succeed, but got ${successful.length}`);
    // Exactly 14 must be rejected due to insufficient funds
    assert.equal(rejected.length, CONCURRENCY_COUNT - 1, `Expected ${CONCURRENCY_COUNT - 1} rejections, but got ${rejected.length}`);

    // Verify account balance is exactly $0.00 (NOT negative!)
    const finalAccount = store.getAccountById(aliceAccount.id);
    assert.equal(finalAccount.balance, 0, `Expected final balance of 0 cents, but got ${finalAccount.balance}`);

    // Verify global double-entry conservation remains 100% intact
    const conservation = ledgerService.verifyConservation(store);
    assert.equal(conservation.isBalanced, true, 'Ledger must remain strictly balanced after race condition test');
    assert.equal(conservation.systemConservation.differenceCents, 0);
  });

  await test.test('Deadlock-Free Bidirectional Concurrent Transfers', async () => {
    // Fund Alice and Bob accounts
    const aliceChecking = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-100001');
    const bobChecking = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-200001');

    const initialAliceBalance = aliceChecking.balance;
    const initialBobBalance = bobChecking.balance;

    const transferPromises = [];
    const ROUNDS = 8;

    const crypto = require('crypto');
    // Concurrently fire transfers from Alice -> Bob AND Bob -> Alice
    for (let i = 0; i < ROUNDS; i++) {
      // Alice -> Bob $10
      transferPromises.push(
        request(app)
          .post('/api/transactions/transfer')
          .set('Authorization', `Bearer ${aliceToken}`)
          .set('Idempotency-Key', `bidi-a2b-${i}-${crypto.randomUUID()}`)
          .send({
            sourceAccountId: aliceChecking.id,
            destinationAccountNumber: bobChecking.accountNumber,
            amount: 10.00
          })
      );

      // Bob -> Alice $10
      transferPromises.push(
        request(app)
          .post('/api/transactions/transfer')
          .set('Authorization', `Bearer ${bobToken}`)
          .set('Idempotency-Key', `bidi-b2a-${i}-${crypto.randomUUID()}`)
          .send({
            sourceAccountId: bobChecking.id,
            destinationAccountNumber: aliceChecking.accountNumber,
            amount: 10.00
          })
      );
    }

    const results = await Promise.all(transferPromises);

    // All should succeed without deadlock or failure
    const allSuccessful = results.every(r => r.status === 200);
    assert.ok(allSuccessful, 'All bidirectional transfers should succeed without deadlocks');

    // Balances should be unchanged net (each transferred $10 * ROUNDS and received $10 * ROUNDS)
    const finalAlice = store.getAccountById(aliceChecking.id);
    const finalBob = store.getAccountById(bobChecking.id);

    assert.equal(finalAlice.balance, initialAliceBalance);
    assert.equal(finalBob.balance, initialBobBalance);

    // Global conservation check
    const conservation = ledgerService.verifyConservation(store);
    assert.equal(conservation.isBalanced, true);
    assert.equal(conservation.systemConservation.differenceCents, 0);
  });
});
