'use strict';

const express = require('express');
const router = express.Router();
const timerManager = require('../services/TimerManager');

/**
 * @route   GET /health
 * @desc    Health-check endpoint
 */
router.get('/', (req, res) => {
  const monitors = timerManager.getAll();
  const active = monitors.filter((m) => m.status === 'active').length;
  const paused = monitors.filter((m) => m.status === 'paused').length;
  const down   = monitors.filter((m) => m.status === 'down').length;

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    monitors: { total: monitors.length, active, paused, down },
  });
});

module.exports = router;
