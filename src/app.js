'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../docs/swagger.json');

const monitorRoutes = require('./routes/monitor.routes');
const healthRoutes = require('./routes/health.routes');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFoundHandler');
const requestLogger = require('./middlewares/requestLogger');

// Bootstrap AlertService so it listens for timer expiry events
require('./services/AlertService');

const app = express();

// ─── Security ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// ─── Body Parsing ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ───────────────────────────────────────────
app.use(requestLogger);

// ─── Swagger Docs ──────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'Pulse-Check API – Watchdog Sentinel',
  customCss: '.swagger-ui .topbar { background-color: #1a1a2e; }',
}));

// ─── Routes ────────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/monitors', monitorRoutes);

// ─── 404 Handler ───────────────────────────────────────────────
app.use(notFoundHandler);

// ─── Centralized Error Handler ─────────────────────────────────
app.use(errorHandler);

module.exports = app;
