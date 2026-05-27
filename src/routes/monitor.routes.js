'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/monitor.controller');

/**
 * @route   POST /monitors
 * @desc    Register a new device monitor
 */
router.post('/', ctrl.register);

/**
 * @route   POST /monitors/:id/heartbeat
 * @desc    Reset the countdown timer for a monitor
 */
router.post('/:id/heartbeat', ctrl.heartbeat);

/**
 * @route   POST /monitors/:id/pause
 * @desc    Pause monitoring (maintenance window)
 */
router.post('/:id/pause', ctrl.pause);

/**
 * @route   GET /monitors
 * @desc    Dashboard – return all monitors
 */
router.get('/', ctrl.getAll);

/**
 * @route   GET /monitors/:id
 * @desc    Return a single monitor's state
 */
router.get('/:id', ctrl.getOne);

/**
 * @route   DELETE /monitors/:id
 * @desc    Remove a monitor and cancel its timer
 */
router.delete('/:id', ctrl.remove);

module.exports = router;
