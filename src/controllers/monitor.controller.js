'use strict';

const timerManager = require('../services/TimerManager');
const { validateRegister } = require('../validators/monitor.validator');
const logger = require('../config/logger');

/**
 * MonitorController
 *
 * Thin controller layer – validates inputs, delegates to TimerManager,
 * and formats HTTP responses. No business logic lives here.
 */

/**
 * POST /monitors
 * Register a new device monitor.
 */
const register = (req, res, next) => {
  try {
    const { error, value } = validateRegister(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join(', '),
      });
    }

    const { id, timeout, alert_email } = value;
    const monitor = timerManager.create(id, timeout, alert_email);

    logger.info(`[Controller] Monitor registered: ${id}`);

    return res.status(201).json({
      success: true,
      message: 'Monitor created successfully',
      id: monitor.id,
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /monitors/:id/heartbeat
 * Reset the countdown for an existing monitor.
 */
const heartbeat = (req, res, next) => {
  try {
    const { id } = req.params;
    timerManager.reset(id);

    logger.info(`[Controller] Heartbeat received for: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Heartbeat received',
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * POST /monitors/:id/pause
 * Pause the countdown for a monitor (maintenance window).
 */
const pause = (req, res, next) => {
  try {
    const { id } = req.params;
    const monitor = timerManager.pause(id);

    logger.info(`[Controller] Monitor paused: ${id}`);

    return res.status(200).json({
      success: true,
      message: `Monitor '${id}' has been paused`,
      monitor,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.statusCode === 409) {
      return res.status(409).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * GET /monitors
 * Return all monitors – the monitoring dashboard.
 */
const getAll = (req, res) => {
  const monitors = timerManager.getAll();
  return res.status(200).json({
    success: true,
    count: monitors.length,
    monitors,
  });
};

/**
 * GET /monitors/:id
 * Return a single monitor's state.
 */
const getOne = (req, res, next) => {
  try {
    const { id } = req.params;
    const monitor = timerManager.get(id);
    return res.status(200).json({ success: true, monitor });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

/**
 * DELETE /monitors/:id
 * Remove a monitor and cancel its timer.
 */
const remove = (req, res, next) => {
  try {
    const { id } = req.params;
    timerManager.delete(id);

    logger.info(`[Controller] Monitor deleted: ${id}`);

    return res.status(200).json({
      success: true,
      message: `Monitor '${id}' deleted successfully`,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = { register, heartbeat, pause, getAll, getOne, remove };
