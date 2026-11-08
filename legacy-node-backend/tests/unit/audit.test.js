const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { Store } = require('../../src/db/store');
const auditService = require('../../src/modules/audit/auditService');

test('Cryptographic Audit Trail Unit Tests', async (t) => {
  const testDbPath = path.resolve(__dirname, `../temp_audit_test_${Date.now()}.json`);
  const testStore = new Store(testDbPath);

  t.after(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  await test.test('empty audit log verifies as valid', async () => {
    const result = auditService.verifyChain(testStore);
    assert.equal(result.isValid, true);
    assert.equal(result.totalEntries, 0);
  });

  await test.test('creates sequential hash-linked audit entries that verify successfully', async () => {
    await testStore.transaction(async (tx) => {
      tx.addAuditLog({
        actorId: 'usr-1',
        actorRole: 'ACCOUNT_HOLDER',
        action: 'LOGIN',
        resourceType: 'USER',
        resourceId: 'usr-1',
        details: { ip: '127.0.0.1' }
      });

      tx.addAuditLog({
        actorId: 'usr-1',
        actorRole: 'ACCOUNT_HOLDER',
        action: 'TRANSFER_EXECUTED',
        resourceType: 'TRANSACTION',
        resourceId: 'tx-123',
        details: { amount: 100 }
      });

      tx.addAuditLog({
        actorId: 'admin',
        actorRole: 'ADMIN',
        action: 'SYSTEM_AUDIT_CHECKED',
        resourceType: 'SYSTEM',
        resourceId: 'SYS',
        details: { status: 'OK' }
      });
    });

    const result = auditService.verifyChain(testStore);
    assert.equal(result.isValid, true);
    assert.equal(result.totalEntries, 3);
    assert.ok(result.genesisHash);
    assert.ok(result.headHash);
  });

  await test.test('detects unauthorized tampering of payload in audit log', async () => {
    // Maliciously tamper with the details of the second audit record directly in memory
    const tamperedStore = new Store(testDbPath);
    tamperedStore.state.auditLogs[1].details = { amount: 99999999, tampered: true };

    const result = auditService.verifyChain(tamperedStore);
    assert.equal(result.isValid, false);
    assert.ok(result.error.includes('Tampering detected at sequence 2'));
    assert.equal(result.tamperedSequence, 2);
  });

  await test.test('detects deletion of an audit record (broken hash link & sequence gap)', async () => {
    // Reset and add 4 entries
    testStore.reset();
    await testStore.transaction(async (tx) => {
      for (let i = 1; i <= 4; i++) {
        tx.addAuditLog({
          actorId: `usr-${i}`,
          actorRole: 'ACCOUNT_HOLDER',
          action: `ACTION_${i}`,
          details: { index: i }
        });
      }
    });

    // Delete record #2 (leaving sequence 1, 3, 4)
    testStore.state.auditLogs.splice(1, 1);

    const result = auditService.verifyChain(testStore);
    assert.equal(result.isValid, false);
    assert.ok(result.error.includes('Sequence discontinuity') || result.error.includes('Broken chain link'));
  });
});

