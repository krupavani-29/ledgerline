const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config');
const { store } = require('../../db/store');

class AuthController {
  async register(req, res, next) {
    try {
      const { username, email, password, fullName } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Username, email, and password are required' }
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long' }
        });
      }

      // Check unique constraints
      if (store.getUserByUsername(username)) {
        return res.status(409).json({
          success: false,
          error: { code: 'USERNAME_TAKEN', message: 'Username is already taken' }
        });
      }

      if (store.getUserByEmail(email)) {
        return res.status(409).json({
          success: false,
          error: { code: 'EMAIL_REGISTERED', message: 'Email is already registered' }
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = `usr-${crypto.randomUUID()}`;
      const defaultAccountId = `acc-${crypto.randomUUID()}`;
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const accountNumber = `LL-ACC-${randomSuffix}`;

      let user, defaultAccount;

      await store.transaction(async (tx) => {
        user = {
          id: userId,
          username: username.trim(),
          email: email.trim().toLowerCase(),
          fullName: fullName || username,
          passwordHash,
          role: config.ROLES.ACCOUNT_HOLDER,
          createdAt: new Date().toISOString()
        };
        tx.addUser(user);

        // Auto-provision initial Checking Account with $0 balance
        defaultAccount = {
          id: defaultAccountId,
          userId,
          accountNumber,
          accountType: config.ACCOUNT_TYPES.USER_CHECKING,
          currency: config.CURRENCY,
          balance: 0, // cents
          status: config.ACCOUNT_STATUS.ACTIVE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        tx.addAccount(defaultAccount);

        tx.addAuditLog({
          actorId: userId,
          actorRole: config.ROLES.ACCOUNT_HOLDER,
          action: 'USER_REGISTERED',
          resourceType: 'USER',
          resourceId: userId,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: { username: user.username, initialAccount: accountNumber }
        });
      });

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          },
          defaultAccount: {
            id: defaultAccount.id,
            accountNumber: defaultAccount.accountNumber,
            accountType: defaultAccount.accountType,
            balance: 0,
            currency: defaultAccount.currency
          },
          token
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_CREDENTIALS', message: 'Username and password are required' }
        });
      }

      const user = store.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }
        });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        // Log failed login attempt
        store.transaction(async (tx) => {
          tx.addAuditLog({
            actorId: user.id,
            actorRole: user.role,
            action: 'LOGIN_FAILED',
            resourceType: 'USER',
            resourceId: user.id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'unknown',
            details: { username: user.username, reason: 'Bad password' }
          });
        }).catch(err => console.error(err));

        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }
        });
      }

      // Log successful login
      store.transaction(async (tx) => {
        tx.addAuditLog({
          actorId: user.id,
          actorRole: user.role,
          action: 'LOGIN_SUCCESS',
          resourceType: 'USER',
          resourceId: user.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'unknown',
          details: { username: user.username }
        });
      }).catch(err => console.error(err));

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        config.JWT_SECRET,
        { expiresIn: config.JWT_EXPIRES_IN }
      );

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role
          },
          token
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const user = store.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();

