const auditService = require('./auditService');
const ledgerService = require('../ledger/ledgerService');
const { store } = require('../../db/store');

class AuditController {
  async getLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const action = req.query.action || null;
      const actorId = req.query.actorId || null;

      const result = auditService.getLogs(store, { limit, offset, action, actorId });
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyChain(req, res, next) {
    try {
      const result = auditService.verifyChain(store);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async conservationCheck(req, res, next) {
    try {
      const result = ledgerService.verifyConservation(store);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuditController();

