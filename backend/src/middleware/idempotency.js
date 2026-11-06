const crypto = require('crypto');
const { store } = require('../db/store');

/**
 * Strict Idempotency Middleware for Financial Transactions.
 * Guarantees that identical requests never execute twice.
 */
function idempotencyMiddleware(options = { required: true }) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    if (!key) {
      if (options.required) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            message: 'Idempotency-Key header is required for this operation to prevent accidental double-execution.'
          }
        });
      }
      return next();
    }

    const trimmedKey = String(key).trim();
    if (trimmedKey.length < 8 || trimmedKey.length > 128) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency-Key must be between 8 and 128 characters.'
        }
      });
    }

    // Hash the endpoint path + serialized body
    const bodyStr = JSON.stringify(req.body || {});
    const canonicalPayload = `${req.method}:${req.baseUrl + req.path}:${bodyStr}`;
    const requestHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
    const userId = req.user ? req.user.id : 'ANONYMOUS';

    // Check existing record under store lock
    const existing = store.getIdempotencyRecord(trimmedKey, userId);

    if (existing) {
      // 1. Conflict: Reusing the same key with different parameters
      if (existing.requestHash !== requestHash) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
            message: 'This Idempotency-Key has already been used for a different request payload.'
          }
        });
      }

      // 2. In-Flight: Concurrent request currently executing
      if (existing.status === 'IN_PROGRESS') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_CONFLICT_IN_PROGRESS',
            message: 'A request with this Idempotency-Key is currently being processed. Please wait and do not retry concurrently.'
          }
        });
      }

      // 3. Completed: Return cached response immediately without re-executing
      if (existing.status === 'COMPLETED') {
        res.setHeader('X-Cache-Lookup', 'HIT');
        res.setHeader('X-Idempotent-Replayed', 'true');
        return res.status(existing.statusCode).json(existing.responseBody);
      }
    }

    // Register in-progress idempotency key
    try {
      await store.transaction(async (tx) => {
        tx.addIdempotencyKey({
          key: trimmedKey,
          userId,
          endpoint: req.baseUrl + req.path,
          requestHash,
          status: 'IN_PROGRESS',
          createdAt: new Date().toISOString()
        });
      });
    } catch (err) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_ACQUIRE_FAILED',
          message: 'Failed to acquire idempotency lock for key.'
        }
      });
    }

    // Intercept response to capture final status and body
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      const statusCode = res.statusCode || 200;
      
      // Update idempotency record asynchronously
      store.transaction(async (tx) => {
        const finalStatus = statusCode < 400 ? 'COMPLETED' : 'FAILED';
        tx.updateIdempotencyKey(trimmedKey, userId, {
          status: finalStatus,
          statusCode,
          responseBody: body,
          completedAt: new Date().toISOString()
        });
      }).catch(err => {
        console.error('Failed to update idempotency record:', err.message);
      });

      return originalJson(body);
    };

    next();
  };
}

module.exports = idempotencyMiddleware;
