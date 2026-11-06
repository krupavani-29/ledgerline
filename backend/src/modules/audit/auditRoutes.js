const express = require('express');
const router = express.Router();
const auditController = require('./auditController');
const { authMiddleware, requireRole } = require('../../middleware/auth');
const config = require('../../config');

router.use(authMiddleware);

// Only Auditor and Admin can view the full audit logs and run ledger verifications
router.use(requireRole(config.ROLES.AUDITOR, config.ROLES.ADMIN));

router.get('/logs', (req, res, next) => auditController.getLogs(req, res, next));
router.get('/verify-chain', (req, res, next) => auditController.verifyChain(req, res, next));
router.get('/conservation-check', (req, res, next) => auditController.conservationCheck(req, res, next));

module.exports = router;
