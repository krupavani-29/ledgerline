const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');
const { store } = require('../../src/db/store');
const { seedDatabase } = require('../../src/db/seed');

test('Security & Authorization (RBAC & IDOR) Integration Tests', async (t) => {
  let aliceToken, bobToken, adminToken, auditorToken;
  let aliceAccount, bobAccount, frozenAccount;

  t.before(async () => {
    await seedDatabase(store);

    // Login Alice
    const resAlice = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Password@123' });
    aliceToken = resAlice.body.data.token;

    // Login Bob
    const resBob = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'Password@123' });
    bobToken = resBob.body.data.token;

    // Login Admin
    const resAdmin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Password@123' });
    adminToken = resAdmin.body.data.token;

    // Login Auditor
    const resAuditor = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auditor', password: 'Password@123' });
    auditorToken = resAuditor.body.data.token;

    aliceAccount = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-100001');
    bobAccount = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-200001');
    frozenAccount = store.getAccounts().find(a => a.accountNumber === 'LL-ACC-300002');
  });

  await test.test('rejects unauthenticated requests to protected endpoints', async () => {
    const res = await request(app).get('/api/accounts');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  await test.test('rejects malformed or expired JWT tokens', async () => {
    const res = await request(app)
      .get('/api/accounts')
      .set('Authorization', 'Bearer invalid.token.signature');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });

  await test.test('RBAC: Account Holder cannot access admin endpoints', async () => {
    const res = await request(app)
      .get('/api/admin/system-stats')
      .set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN_ROLE');
  });

  await test.test('RBAC: Account Holder cannot access audit logs', async () => {
    const res = await request(app)
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN_ROLE');
  });

  await test.test('RBAC: Auditor cannot execute money movements (Strict Read-Only)', async () => {
    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${auditorToken}`)
      .set('Idempotency-Key', 'auditor-illegal-transfer-001')
      .send({
        sourceAccountId: aliceAccount.id,
        destinationAccountNumber: bobAccount.accountNumber,
        amount: 100
      });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN_ROLE');
  });

  await test.test('Anti-IDOR: Alice cannot view Bob account details', async () => {
    const res = await request(app)
      .get(`/api/accounts/${bobAccount.id}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN_IDOR');
  });

  await test.test('Anti-IDOR: Alice cannot view Bob transaction statement', async () => {
    const res = await request(app)
      .get(`/api/accounts/${bobAccount.id}/statement`)
      .set('Authorization', `Bearer ${aliceToken}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN_IDOR');
  });

  await test.test('Anti-IDOR: Alice cannot transfer money OUT of Bob account', async () => {
    const res = await request(app)
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', 'alice-theft-attempt-001')
      .send({
        sourceAccountId: bobAccount.id, // Bob's account!
        destinationAccountNumber: aliceAccount.accountNumber,
        amount: 500
      });
    assert.equal(res.status, 403);
    assert.ok(res.body.error.message.includes('cannot transfer funds from an account you do not own'));

    // Verify security alert was logged to immutable audit trail
    const auditLogs = store.getAuditLogs();
    const idorAlert = auditLogs.find(l => l.action === 'SECURITY_IDOR_BLOCKED' && l.actorId === store.getUserByUsername('alice').id);
    assert.ok(idorAlert, 'Expected SECURITY_IDOR_BLOCKED to be recorded in audit log');
  });

  await test.test('Frozen Account: Transactions from frozen accounts are blocked', async () => {
    // Charlie login
    const resCharlie = await request(app)
      .post('/api/auth/login')
      .send({ username: 'charlie', password: 'Password@123' });
    const charlieToken = resCharlie.body.data.token;

    const res = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${charlieToken}`)
      .set('Idempotency-Key', 'charlie-frozen-withdraw-001')
      .send({
        accountId: frozenAccount.id,
        amount: 50
      });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('FROZEN'));
  });

  await test.test('Input Validation: Rejects negative, zero, or non-numeric amounts', async () => {
    const resNeg = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', 'alice-neg-withdraw-001')
      .send({ accountId: aliceAccount.id, amount: -100 });
    assert.equal(resNeg.status, 400);

    const resZero = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', 'alice-zero-withdraw-001')
      .send({ accountId: aliceAccount.id, amount: 0 });
    assert.equal(resZero.status, 400);

    const resNaN = await request(app)
      .post('/api/transactions/withdraw')
      .set('Authorization', `Bearer ${aliceToken}`)
      .set('Idempotency-Key', 'alice-nan-withdraw-001')
      .send({ accountId: aliceAccount.id, amount: 'one-million' });
    assert.equal(resNaN.status, 400);
  });
});
