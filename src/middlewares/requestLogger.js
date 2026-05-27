'use strict';

const logger = require('../config/logger');

/**
 * HTTP request logger middleware.
 * Logs method, path, status code, and response time.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} – ${ms}ms`;
    if (res.statusCode >= 500) {
      logger.error(`[HTTP] ${msg}`);
    } else if (res.statusCode >= 400) {
      logger.warn(`[HTTP] ${msg}`);
    } else {
      logger.info(`[HTTP] ${msg}`);
    }
  });

  next();
};

module.exports = requestLogger;
