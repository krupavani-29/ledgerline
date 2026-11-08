const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const { store } = require('./store');
const ledgerService = require('../modules/ledger/ledgerService');
const auditService = require('../modules/audit/auditService');

async function seedDatabase(customStore = store) {
  customStore.reset();

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const now = new Date().toISOString();

  await customStore.transaction(async (tx) => {
    // 1. Genesis Block for Cryptographic Audit Trail
    tx.addAuditLog({
      id: 'audit-genesis-000001',
      actorId: 'SYSTEM',
      actorRole: 'SYSTEM',
      action: 'SYSTEM_INITIALIZED',
      resourceType: 'SYSTEM',
      resourceId: 'LEDGERLINE_GENESIS',
      details: { version: '1.0.0', currency: config.CURRENCY }
    });

    // 2. System Reserve / Settlement Account
    const systemReserve = {
      id: config.SYSTEM_RESERVE_ACCOUNT_ID,
      userId: 'system',
      accountNumber: config.SYSTEM_RESERVE_ACCOUNT_NUMBER,
      accountType: config.ACCOUNT_TYPES.SYSTEM_RESERVE,
      currency: config.CURRENCY,
      balance: 0,
      status: config.ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now
    };
    tx.addAccount(systemReserve);

    // 3. Admin User
    const adminUser = {
      id: 'usr-admin-0001',
      username: 'admin',
      email: 'admin@ledgerline.io',
      fullName: 'System Administrator',
      passwordHash: defaultPasswordHash,
      role: config.ROLES.ADMIN,
      createdAt: now
    };
    tx.addUser(adminUser);

    // 4. Auditor User
    const auditorUser = {
      id: 'usr-auditor-0001',
      username: 'auditor',
      email: 'auditor@ledgerline.io',
      fullName: 'Chief Compliance Auditor',
      passwordHash: defaultPasswordHash,
      role: config.ROLES.AUDITOR,
      createdAt: now
    };
    tx.addUser(auditorUser);

    // 5. Account Holder: Alice
    const alice = {
      id: 'usr-alice-0001',
      username: 'alice',
      email: 'alice@ledgerline.io',
      fullName: 'Alice Johnson',
      passwordHash: defaultPasswordHash,
      role: config.ROLES.ACCOUNT_HOLDER,
      createdAt: now
    };
    tx.addUser(alice);

    const aliceChecking = {
      id: 'acc-alice-checking-001',
      userId: alice.id,
      accountNumber: 'LL-ACC-100001',
      accountType: config.ACCOUNT_TYPES.USER_CHECKING,
      currency: config.CURRENCY,
      balance: 0,
      status: config.ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now
    };
    tx.addAccount(aliceChecking);

    const aliceSavings = {
      id: 'acc-alice-savings-002',
      userId: alice.id,
      accountNumber: 'LL-ACC-100002',
      accountType: config.ACCOUNT_TYPES.USER_SAVINGS,
      currency: config.CURRENCY,
      balance: 0,
      status: config.ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now
    };
    tx.addAccount(aliceSavings);

    // 6. Account Holder: Bob
    const bob = {
      id: 'usr-bob-0002',
      username: 'bob',
      email: 'bob@ledgerline.io',
      fullName: 'Bob Smith',
      passwordHash: defaultPasswordHash,
      role: config.ROLES.ACCOUNT_HOLDER,
      createdAt: now
    };
    tx.addUser(bob);

    const bobChecking = {
      id: 'acc-bob-checking-001',
      userId: bob.id,
      accountNumber: 'LL-ACC-200001',
      accountType: config.ACCOUNT_TYPES.USER_CHECKING,
      currency: config.CURRENCY,
      balance: 0,
      status: config.ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now
    };
    tx.addAccount(bobChecking);

    // 7. Account Holder: Charlie
    const charlie = {
      id: 'usr-charlie-0003',
      username: 'charlie',
      email: 'charlie@ledgerline.io',
      fullName: 'Charlie Davis',
      passwordHash: defaultPasswordHash,
      role: config.ROLES.ACCOUNT_HOLDER,
      createdAt: now
    };
    tx.addUser(charlie);

    const charlieChecking = {
      id: 'acc-charlie-checking-001',
      userId: charlie.id,
      accountNumber: 'LL-ACC-300001',
      accountType: config.ACCOUNT_TYPES.USER_CHECKING,
      currency: config.CURRENCY,
      balance: 0,
      status: config.ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now
    };
    tx.addAccount(charlieChecking);

    const charlieFrozen = {
      id: 'acc-charlie-frozen-002',
      userId: charlie.id,
      accountNumber: 'LL-ACC-300002',
      accountType: config.ACCOUNT_TYPES.USER_SAVINGS,
      currency: config.CURRENCY,
      balance: 0,
      status: config.ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now
    };
    tx.addAccount(charlieFrozen);

    // Seed Initial Balanced Deposits via Double-Entry
    // Deposit $5,000 into Alice Checking
    ledgerService.recordTransaction(tx, {
      entryType: config.TRANSACTION_TYPES.DEPOSIT,
      description: 'Initial Seed Deposit: Alice Checking ($5,000.00)',
      legs: [
        { accountId: systemReserve.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: 500000 },
        { accountId: aliceChecking.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: 500000 }
      ]
    });

    // Deposit $10,000 into Alice Savings
    ledgerService.recordTransaction(tx, {
      entryType: config.TRANSACTION_TYPES.DEPOSIT,
      description: 'Initial Seed Deposit: Alice Savings ($10,000.00)',
      legs: [
        { accountId: systemReserve.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: 1000000 },
        { accountId: aliceSavings.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: 1000000 }
      ]
    });

    // Deposit $2,500 into Bob Checking
    ledgerService.recordTransaction(tx, {
      entryType: config.TRANSACTION_TYPES.DEPOSIT,
      description: 'Initial Seed Deposit: Bob Checking ($2,500.00)',
      legs: [
        { accountId: systemReserve.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: 250000 },
        { accountId: bobChecking.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: 250000 }
      ]
    });

    // Deposit $500 into Charlie Checking
    ledgerService.recordTransaction(tx, {
      entryType: config.TRANSACTION_TYPES.DEPOSIT,
      description: 'Initial Seed Deposit: Charlie Checking ($500.00)',
      legs: [
        { accountId: systemReserve.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: 50000 },
        { accountId: charlieChecking.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: 50000 }
      ]
    });

    // Deposit $1,000 into Charlie Frozen account (before it was frozen)
    ledgerService.recordTransaction(tx, {
      entryType: config.TRANSACTION_TYPES.DEPOSIT,
      description: 'Initial Seed Deposit: Charlie Frozen Account ($1,000.00)',
      legs: [
        { accountId: systemReserve.id, direction: config.ENTRY_DIRECTION.DEBIT, amount: 100000 },
        { accountId: charlieFrozen.id, direction: config.ENTRY_DIRECTION.CREDIT, amount: 100000 }
      ]
    });

    // Now freeze Charlie's second account for frozen-account testing
    tx.updateAccount(charlieFrozen.id, { status: config.ACCOUNT_STATUS.FROZEN });

    // Log seed completion
    tx.addAuditLog({
      actorId: 'SYSTEM',
      actorRole: 'SYSTEM',
      action: 'DATABASE_SEEDED',
      resourceType: 'SYSTEM',
      resourceId: 'SEED_RUN',
      details: {
        usersCreated: 5,
        accountsCreated: 7,
        totalInitialDeposits: '$19,000.00'
      }
    });
  });

  console.log('Database seeded successfully with demo users, accounts, and cryptographic audit chain.');
  const chainCheck = auditService.verifyChain(customStore);
  console.log('Audit chain verification:', chainCheck.message);
  const ledgerCheck = ledgerService.verifyConservation(customStore);
  console.log('Ledger conservation check: balanced =', ledgerCheck.isBalanced);
}

if (require.main === module) {
  seedDatabase().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
