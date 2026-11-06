const { TransactionService } = require('./transactionService');
const { store } = require('../../db/store');

class TransactionController {
  async deposit(req, res, next) {
    try {
      const { accountId, amount, description } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

      const result = await TransactionService.deposit(store, {
        userId: req.user.id,
        userRole: req.user.role,
        accountId,
        amount,
        description,
        idempotencyKey,
        ip: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async withdraw(req, res, next) {
    try {
      const { accountId, amount, description } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

      const result = await TransactionService.withdraw(store, {
        userId: req.user.id,
        userRole: req.user.role,
        accountId,
        amount,
        description,
        idempotencyKey,
        ip: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async transfer(req, res, next) {
    try {
      const { sourceAccountId, destinationAccountNumber, amount, description } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

      const result = await TransactionService.transfer(store, {
        userId: req.user.id,
        userRole: req.user.role,
        sourceAccountId,
        destinationAccountNumber,
        amount,
        description,
        idempotencyKey,
        ip: req.ip || req.connection.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown'
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TransactionController();
