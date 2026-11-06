const express = require('express');
const router = express.Router();
const transactionController = require('./transactionController');
const { authMiddleware, requireRole } = require('../../middleware/auth');
const idempotencyMiddleware = require('../../middleware/idempotency');
const config = require('../../config');

// Require authentication for all transaction routes
router.use(authMiddleware);

// Only Account Holders and Admins can execute transactions (Auditors have strict READ-ONLY access!)
router.use(requireRole(config.ROLES.ACCOUNT_HOLDER, config.ROLES.ADMIN));

// Apply strict idempotency middleware to all financial money movement endpoints
router.post('/deposit', idempotencyMiddleware({ required: true }), (req, res, next) => {
  transactionController.deposit(req, res, next);
});

router.post('/withdraw', idempotencyMiddleware({ required: true }), (req, res, next) => {
  transactionController.withdraw(req, res, next);
});

router.post('/transfer', idempotencyMiddleware({ required: true }), (req, res, next) => {
  transactionController.transfer(req, res, next);
});

module.exports = router;
