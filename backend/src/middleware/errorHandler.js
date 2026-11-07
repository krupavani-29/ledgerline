const config = require('../config');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  // In production, mask internal server error messages to prevent data leaks
  const message = (statusCode === 500 && config.NODE_ENV === 'production')
    ? 'An unexpected internal server error occurred'
    : err.message || 'An error occurred';

  const response = {
    success: false,
    error: {
      code: errorCode,
      message
    }
  };

  // Only include details or stack trace in development
  if (config.NODE_ENV === 'development' && statusCode === 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;

