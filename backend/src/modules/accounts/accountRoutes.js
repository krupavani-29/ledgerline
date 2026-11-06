const express = require('express');
const router = express.Router();
const accountController = require('./accountController');
const { authMiddleware, requireRole } = require('../../middleware/auth');
const config = require('../../config');

router.use(authMiddleware);

// Create account (Account Holders & Admins)
router.post('/', requireRole(config.ROLES.ACCOUNT_HOLDER, config.ROLES.ADMIN), (req, res, next) => accountController.createAccount(req, res, next));

// List accounts (Filtered by ownership for users, all for Auditor/Admin)
router.get('/', (req, res, next) => accountController.getAccounts(req, res, next));

// Get specific account (Enforces Anti-IDOR)
router.get('/:id', (req, res, next) => accountController.getAccountById(req, res, next));

// Get transaction statement (Enforces Anti-IDOR)
router.get('/:id/statement', (req, res, next) => accountController.getAccountStatement(req, res, next));

module.exports = router;
