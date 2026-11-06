const express = require('express');
const router = express.Router();
const adminController = require('./adminController');
const { authMiddleware, requireRole } = require('../../middleware/auth');
const config = require('../../config');

router.use(authMiddleware);
router.use(requireRole(config.ROLES.ADMIN));

router.get('/system-stats', (req, res, next) => adminController.getSystemStats(req, res, next));
router.get('/users', (req, res, next) => adminController.getUsers(req, res, next));
router.patch('/accounts/:id/status', (req, res, next) => adminController.updateAccountStatus(req, res, next));

module.exports = router;
