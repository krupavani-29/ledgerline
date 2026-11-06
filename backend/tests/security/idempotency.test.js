const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');
const { store } = require('../../src/db/store');
const { seedDatabase } = require('../../src/db/seed');

test('Strict Financial Idempotency Tests', async (t) => {
  let aliceToken;
  let aliceAccount, bobAccount;

  t.before(async () => {
    await seedDatabase(store);

    const resAlice = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Password@123' });
    aliceToken = resAlice.body.data.token;

    aliceAccount = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-100001');
    bobAccount = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-200001');
  });

  await test.test('rejects money movement request when Idempotency-Key header is missing', async () => {
    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        sourceAccountId: aliceAccount.id,
        destinationAccountNumber: bobAccount.accountNumber,
        amount: 50
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
  });

  await test.test('identical request with same Idempotency-Key returns cached response without duplicate debit', async () => {
    const initialAliceBalance = store.getAccountById(aliceAccount.id).balance;
    const initialBobBalance = store.getAccountById(bobAccount.id).balance;
    const idempotencyKey = `transfer-idemp-${Date.now()}`;

    // Request 1: First attempt
    const res1 = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sourceAccountId: aliceAccount.id,
        destinationAccountNumber: bobAccount.accountNumber,
        amount: 150.00,
        description: 'Idempotency verification payment'
      });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.success, true);
    const txId = res1.body.data.transactionId;

    // Verify first debit occurred
    const balanceAfterReq1 = store.getAccountById(aliceAccount.id).balance;
    assert.equal(balanceAfterReq1, initialAliceBalance - 15000);

    // Request 2: Duplicate retry with exact same key and payload (network retry simulation)
    const res2 = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sourceAccountId: aliceAccount.id,
        destinationAccountNumber: bobAccount.accountNumber,
        amount: 150.00,
        description: 'Idempotency verification payment'
      });

    assert.equal(res2.status, 200);
    assert.equal(res2.headers['x-idempotent-replayed'], 'true');
    assert.equal(res2.body.data.transactionId, txId);

    // Verify Alice was NOT debited a second time!
    const balanceAfterReq2 = store.getAccountById(aliceAccount.id).balance;
    assert.equal(balanceAfterReq2, balanceAfterReq1);

    // Verify Bob was NOT credited a second time!
    const bobBalanceAfterReq2 = store.getAccountById(bobAccount.id).balance;
    assert.equal(bobBalanceAfterReq2, initialBobBalance + 15000);
  });

  await test.test('rejects attempt to reuse same Idempotency-Key with different payload', async () => {
    const idempotencyKey = `reused-key-${Date.now()}`;

    // Initial valid request
    const res1 = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sourceAccountId: aliceAccount.id,
        destinationAccountNumber: bobAccount.accountNumber,
        amount: 25.00
      });
    assert.equal(res1.status, 200);

    // Tampered retry: same key, but changing amount to $999.00
    const resTampered = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        sourceAccountId: aliceAccount.id,
        destinationAccountNumber: bobAccount.accountNumber,
        amount: 999.00
      });

    assert.equal(resTampered.status, 409);
    assert.equal(resTampered.body.error.code, 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
  });
});
