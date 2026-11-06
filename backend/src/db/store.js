const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

class Store {
  constructor(filePath = config.DB_FILE) {
    this.filePath = filePath;
    this.dataDir = path.dirname(filePath);
    
    // In-memory state
    this.state = {
      users: [],
      accounts: [],
      journalEntries: [],
      postingLegs: [],
      idempotencyKeys: [],
      auditLogs: []
    };

    // Account Mutex Lock Map for Pessimistic Concurrency Control
    this.locks = new Map();
    // Global transaction lock for write serialization
    this.globalMutex = Promise.resolve();

    this._ensureDir();
    this.load();
  }

  _ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.state = JSON.parse(raw);
      } catch (err) {
        console.error('Error loading database file, initializing fresh store:', err.message);
      }
    }
  }

  persist() {
    this._ensureDir();
    const tempPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const data = JSON.stringify(this.state, null, 2);
    fs.writeFileSync(tempPath, data, 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  // --- Mutex / Concurrency Control ---
  // Deadlock-free pessimistic lock on multiple accounts
  async withLock(accountIds, callback) {
    // Deduplicate and sort account IDs to prevent circular deadlocks
    const uniqueSortedIds = Array.from(new Set(accountIds)).sort();
    
    const acquireLock = (id) => {
      let currentLock = this.locks.get(id) || Promise.resolve();
      let releaseLock;
      const newLock = new Promise(resolve => {
        releaseLock = resolve;
      });
      this.locks.set(id, currentLock.then(() => releaseLock));
      return currentLock;
    };

    // Chain locks in sorted order
    const releaseFunctions = [];
    try {
      for (const id of uniqueSortedIds) {
        let releaseFn;
        const lockPromise = new Promise(res => { releaseFn = res; });
        const previousLock = this.locks.get(id) || Promise.resolve();
        this.locks.set(id, previousLock.then(() => lockPromise));
        await previousLock;
        releaseFunctions.push(releaseFn);
      }

      // Execute protected critical section
      return await callback();
    } finally {
      // Release in reverse order
      while (releaseFunctions.length > 0) {
        const releaseFn = releaseFunctions.pop();
        if (releaseFn) releaseFn();
      }
    }
  }

  // --- ACID Transaction Support ---
  async transaction(fn) {
    // Chain onto global write mutex to serialize atomic state transitions
    let releaseGlobal;
    const currentGlobal = this.globalMutex;
    this.globalMutex = new Promise(resolve => { releaseGlobal = resolve; });
    await currentGlobal;

    let snapshot;
    try {
      // Snapshot state
      snapshot = JSON.parse(JSON.stringify(this.state));

      const txContext = {
        state: this.state,
        
        getUserById: (id) => this.state.users.find(u => u.id === id),
        getUserByUsername: (username) => this.state.users.find(u => u.username.toLowerCase() === username.toLowerCase()),
        getUserByEmail: (email) => this.state.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
        addUser: (user) => {
          this.state.users.push(user);
          return user;
        },

        getAccountById: (id) => this.state.accounts.find(a => a.id === id),
        getAccountByNumber: (accNum) => this.state.accounts.find(a => a.accountNumber === accNum),
        getAccountsByUserId: (userId) => this.state.accounts.filter(a => a.userId === userId),
        getAllAccounts: () => [...this.state.accounts],
        addAccount: (account) => {
          this.state.accounts.push(account);
          return account;
        },
        updateAccount: (id, updates) => {
          const acc = this.state.accounts.find(a => a.id === id);
          if (!acc) throw new Error(`Account ${id} not found`);
          Object.assign(acc, updates, { updatedAt: new Date().toISOString() });
          return acc;
        },

        addJournalEntry: (entry) => {
          this.state.journalEntries.push(entry);
          return entry;
        },
        addPostingLeg: (leg) => {
          this.state.postingLegs.push(leg);
          return leg;
        },

        getIdempotencyKey: (key, userId) => {
          return this.state.idempotencyKeys.find(k => k.key === key && k.userId === userId);
        },
        addIdempotencyKey: (record) => {
          this.state.idempotencyKeys.push(record);
          return record;
        },
        updateIdempotencyKey: (key, userId, updates) => {
          const rec = this.state.idempotencyKeys.find(k => k.key === key && k.userId === userId);
          if (rec) Object.assign(rec, updates);
          return rec;
        },

        addAuditLog: (log) => {
          // Compute sequence and previous hash
          const lastLog = this.state.auditLogs[this.state.auditLogs.length - 1];
          const sequenceNum = lastLog ? lastLog.sequenceNum + 1 : 1;
          const previousHash = lastLog ? lastLog.entryHash : '0000000000000000000000000000000000000000000000000000000000000000';
          
          const logEntry = {
            id: log.id || crypto.randomUUID(),
            sequenceNum,
            timestamp: log.timestamp || new Date().toISOString(),
            actorId: log.actorId || 'SYSTEM',
            actorRole: log.actorRole || 'SYSTEM',
            action: log.action,
            resourceType: log.resourceType || 'SYSTEM',
            resourceId: log.resourceId || 'N/A',
            ipAddress: log.ipAddress || '127.0.0.1',
            userAgent: log.userAgent || 'system',
            details: log.details || {},
            previousHash
          };

          // Compute cryptographic tamper-evident SHA-256 hash
          const payload = `${logEntry.sequenceNum}:${logEntry.id}:${logEntry.timestamp}:${logEntry.actorId}:${logEntry.actorRole}:${logEntry.action}:${logEntry.resourceType}:${logEntry.resourceId}:${JSON.stringify(logEntry.details)}:${previousHash}`;
          logEntry.entryHash = crypto.createHash('sha256').update(payload).digest('hex');

          this.state.auditLogs.push(logEntry);
          return logEntry;
        }
      };

      // Execute transaction logic
      const result = await fn(txContext);

      // --- Post-Transaction Invariant Verification ---
      // 1. Invariant: Server-side prevention of negative balances
      for (const acc of this.state.accounts) {
        if (acc.balance < 0) {
          throw new Error(`Integrity Violation: Account ${acc.accountNumber} balance cannot be negative (${acc.balance})`);
        }
      }

      // 2. Invariant: System Conservation check on new journal entries
      // Ensure all journal entries added in this tx have sum(debit) == sum(credit)
      const unpostedLegsByEntry = {};
      for (const leg of this.state.postingLegs) {
        if (!unpostedLegsByEntry[leg.journalEntryId]) {
          unpostedLegsByEntry[leg.journalEntryId] = { debits: 0, credits: 0 };
        }
        if (leg.direction === config.ENTRY_DIRECTION.DEBIT) {
          unpostedLegsByEntry[leg.journalEntryId].debits += leg.amount;
        } else if (leg.direction === config.ENTRY_DIRECTION.CREDIT) {
          unpostedLegsByEntry[leg.journalEntryId].credits += leg.amount;
        }
      }

      for (const [entryId, sums] of Object.entries(unpostedLegsByEntry)) {
        if (sums.debits !== sums.credits) {
          throw new Error(`Double-Entry Violation: Journal Entry ${entryId} does not balance (Debits: ${sums.debits}, Credits: ${sums.credits})`);
        }
      }

      // Persist state atomically
      this.persist();

      return result;
    } catch (err) {
      // Rollback to snapshot on any invariant failure or uncaught error
      this.state = JSON.parse(JSON.stringify(snapshot));
      throw err;
    } finally {
      if (releaseGlobal) releaseGlobal();
    }
  }

  // --- Read helpers ---
  get stateSnapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  getUsers() { return [...this.state.users]; }
  getUserById(id) { return this.state.users.find(u => u.id === id); }
  getUserByUsername(username) {
    return this.state.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  getAccounts() { return [...this.state.accounts]; }
  getAccountById(id) { return this.state.accounts.find(a => a.id === id); }
  getAccountByNumber(num) { return this.state.accounts.find(a => a.accountNumber === num); }
  getAccountsByUserId(userId) { return this.state.accounts.filter(a => a.userId === userId); }

  getJournalEntries() { return [...this.state.journalEntries]; }
  getPostingLegs(journalEntryId) {
    if (journalEntryId) {
      return this.state.postingLegs.filter(l => l.journalEntryId === journalEntryId);
    }
    return [...this.state.postingLegs];
  }

  getPostingLegsForAccount(accountId) {
    return this.state.postingLegs.filter(l => l.accountId === accountId);
  }

  getAuditLogs() { return [...this.state.auditLogs]; }

  getIdempotencyRecord(key, userId) {
    return this.state.idempotencyKeys.find(k => k.key === key && k.userId === userId);
  }

  // --- Reset (for test isolation) ---
  reset() {
    this.state = {
      users: [],
      accounts: [],
      journalEntries: [],
      postingLegs: [],
      idempotencyKeys: [],
      auditLogs: []
    };
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }
}

// Singleton instance
const storeInstance = new Store();

module.exports = {
  Store,
  store: storeInstance
};
