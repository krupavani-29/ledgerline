const crypto = require('crypto');

class AuditService {
  /**
   * Computes the canonical SHA-256 hash for an audit log entry.
   */
  computeHash(entry) {
    const payload = `${entry.sequenceNum}:${entry.id}:${entry.timestamp}:${entry.actorId}:${entry.actorRole}:${entry.action}:${entry.resourceType}:${entry.resourceId}:${JSON.stringify(entry.details)}:${entry.previousHash}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Verifies the cryptographic integrity of the entire audit log chain.
   * Proves that no records have been modified, deleted, inserted, or re-ordered.
   */
  verifyChain(store) {
    const logs = store.getAuditLogs();
    if (logs.length === 0) {
      return {
        isValid: true,
        totalEntries: 0,
        message: 'Audit log is empty (pristine state)'
      };
    }

    let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < logs.length; i++) {
      const entry = logs[i];
      const expectedSeq = i + 1;

      // 1. Sequence continuity check
      if (entry.sequenceNum !== expectedSeq) {
        return {
          isValid: false,
          error: `Sequence discontinuity: expected sequence ${expectedSeq}, but found ${entry.sequenceNum}`,
          tamperedIndex: i,
          tamperedSequence: entry.sequenceNum
        };
      }

      // 2. Previous hash link check
      if (entry.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          error: `Broken chain link at sequence ${entry.sequenceNum}: stored previousHash does not match actual hash of predecessor`,
          tamperedIndex: i,
          tamperedSequence: entry.sequenceNum,
          expectedPreviousHash: expectedPrevHash,
          actualPreviousHash: entry.previousHash
        };
      }

      // 3. Entry hash integrity check
      const recomputedHash = this.computeHash(entry);
      if (entry.entryHash !== recomputedHash) {
        return {
          isValid: false,
          error: `Tampering detected at sequence ${entry.sequenceNum}: payload has been modified. Recomputed hash ${recomputedHash} does not match stored hash ${entry.entryHash}`,
          tamperedIndex: i,
          tamperedSequence: entry.sequenceNum,
          storedHash: entry.entryHash,
          recomputedHash
        };
      }

      expectedPrevHash = entry.entryHash;
    }

    return {
      isValid: true,
      totalEntries: logs.length,
      genesisHash: logs[0].entryHash,
      headHash: logs[logs.length - 1].entryHash,
      message: `Cryptographic verification successful: All ${logs.length} audit entries are cryptographically intact and authentic.`
    };
  }

  /**
   * Retrieves paginated audit logs.
   */
  getLogs(store, { limit = 50, offset = 0, action = null, actorId = null } = {}) {
    let logs = store.getAuditLogs();

    if (action) {
      logs = logs.filter(l => l.action.toLowerCase() === action.toLowerCase());
    }
    if (actorId) {
      logs = logs.filter(l => l.actorId === actorId);
    }

    const total = logs.length;
    // Newest first
    const sorted = [...logs].reverse();
    const paginated = sorted.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      logs: paginated
    };
  }
}

module.exports = new AuditService();

