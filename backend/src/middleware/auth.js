const jwt = require('jsonwebtoken');
const config = require('../config');
const { store } = require('../db/store');

/**
 * Authentication Middleware: Validates Bearer JWT Token.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or malformed'
      }
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = store.getUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The user associated with this token no longer exists'
        }
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired. Please log in again.'
        }
      });
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      }
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Enforces least privilege for ADMIN, ACCOUNT_HOLDER, and AUDITOR.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized privilege escalation attempt
      store.transaction(async (tx) => {
        tx.addAuditLog({
          actorId: req.user.id,
          actorRole: req.user.role,
          action: 'SECURITY_UNAUTHORIZED_ROLE_ACCESS',
          resourceType: 'API_ENDPOINT',
          resourceId: req.originalUrl,
          ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: {
            requiredRoles: allowedRoles,
            userRole: req.user.role,
            method: req.method
          }
        });
      }).catch(err => console.error('Audit log error:', err.message));

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Access denied: Role "${req.user.role}" does not have permission to access this resource`
        }
      });
    }

    next();
  };
}

module.exports = {
  authMiddleware,
  requireRole
};

