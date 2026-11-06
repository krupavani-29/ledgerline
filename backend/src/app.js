const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./modules/auth/authRoutes');
const accountRoutes = require('./modules/accounts/accountRoutes');
const transactionRoutes = require('./modules/transactions/transactionRoutes');
const auditRoutes = require('./modules/audit/auditRoutes');
const adminRoutes = require('./modules/admin/adminRoutes');

const app = express();

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false // Allows inline scripts for dev and React hydration
}));

// Cross-Origin Resource Sharing
app.use(cors({
  origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Idempotency-Key'],
  exposedHeaders: ['X-Idempotent-Replayed', 'X-Cache-Lookup']
}));

// Body Parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request Logger (skip in test mode)
if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// System Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'LedgerLine High-Integrity Financial Engine',
    version: '1.0.0',
    currency: config.CURRENCY,
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/admin', adminRoutes);

// Production Static Frontend Delivery
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Central Error Handler
app.use(errorHandler);

module.exports = app;
