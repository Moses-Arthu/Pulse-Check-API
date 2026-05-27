'use strict';

const logger = require('../config/logger');

/**
 * Centralized error-handling middleware.
 * Must have exactly 4 arguments so Express recognises it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    logger.error(`[ErrorHandler] ${req.method} ${req.path} – ${message}`, { stack: err.stack });
  } else {
    logger.warn(`[ErrorHandler] ${req.method} ${req.path} – ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
