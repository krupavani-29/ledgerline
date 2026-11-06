const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { authMiddleware } = require('../../middleware/auth');

router.post('/register', (req, res, next) => authController.register(req, res, next));
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.get('/me', authMiddleware, (req, res, next) => authController.me(req, res, next));

module.exports = router;
