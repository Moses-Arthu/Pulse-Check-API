'use strict';

const EventEmitter = require('events');
const logger = require('../config/logger');

/**
 * TimerManager – Core engine for the Dead Man's Switch.
 *
 * Manages a Map of monitor records and drives countdown timers using
 * setInterval. Each monitor ticks every second. When remaining hits 0
 * the monitor transitions to "down" and emits an "alert" event.
 *
 * Implements SOLID principles:
 *  - Single Responsibility: only manages timer state
 *  - Open/Closed: extend via events without modifying this class
 *  - Dependency Inversion: consumers depend on the emitted events, not internals
 */
class TimerManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, MonitorRecord>} */
    this.monitors = new Map();
  }

  /**
   * Create and immediately start a new monitor.
   * @param {string} id
   * @param {number} timeout  seconds
   * @param {string} alertEmail
   * @returns {MonitorRecord}
   */
  create(id, timeout, alertEmail) {
    if (this.monitors.has(id)) {
      const err = new Error(`Monitor with id '${id}' already exists`);
      err.statusCode = 409;
      throw err;
    }

    const record = {
      id,
      timeout,
      remaining: timeout,
      alertEmail,
      status: 'active',
      lastHeartbeat: null,
      createdAt: new Date().toISOString(),
      intervalId: null,
    };

    this.monitors.set(id, record);
    this._startInterval(id);

    logger.info(`[TimerManager] Monitor created: ${id} (timeout: ${timeout}s)`);
    return this._toPublic(record);
  }

  /**
   * Reset the countdown for an existing monitor.
   * If the monitor was paused it will be resumed.
   * @param {string} id
   * @returns {MonitorRecord}
   */
  reset(id) {
    const record = this._getOrThrow(id);

    // Clear existing interval so we start fresh
    this._clearInterval(record);

    record.remaining = record.timeout;
    record.lastHeartbeat = new Date().toISOString();
    record.status = 'active';

    this._startInterval(id);

    logger.info(`[TimerManager] Heartbeat received for: ${id}`);
    return this._toPublic(record);
  }

  /**
   * Pause the countdown for a monitor.
   * @param {string} id
   * @returns {MonitorRecord}
   */
  pause(id) {
    const record = this._getOrThrow(id);

    if (record.status === 'down') {
      const err = new Error('Cannot pause a monitor that is already down');
      err.statusCode = 409;
      throw err;
    }

    if (record.status === 'paused') {
      const err = new Error('Monitor is already paused');
      err.statusCode = 409;
      throw err;
    }

    this._clearInterval(record);
    record.status = 'paused';

    logger.info(`[TimerManager] Monitor paused: ${id}`);
    return this._toPublic(record);
  }

  /**
   * Get a single monitor's public state.
   * @param {string} id
   * @returns {MonitorRecord}
   */
  get(id) {
    const record = this._getOrThrow(id);
    return this._toPublic(record);
  }

  /**
   * Return all monitors as an array.
   * @returns {MonitorRecord[]}
   */
  getAll() {
    return Array.from(this.monitors.values()).map(this._toPublic);
  }

  /**
   * Delete a monitor and cancel its timer.
   * @param {string} id
   */
  delete(id) {
    const record = this._getOrThrow(id);
    this._clearInterval(record);
    this.monitors.delete(id);
    logger.info(`[TimerManager] Monitor deleted: ${id}`);
  }

  // ─── Private Helpers ─────────────────────────────────────────

  _startInterval(id) {
    const record = this.monitors.get(id);
    if (!record) return;

    record.intervalId = setInterval(() => {
      const r = this.monitors.get(id);
      if (!r || r.status !== 'active') return;

      r.remaining -= 1;

      if (r.remaining <= 0) {
        r.remaining = 0;
        r.status = 'down';
        clearInterval(r.intervalId);
        r.intervalId = null;

        const alertPayload = {
          ALERT: `Device ${id} is down!`,
          time: new Date().toISOString(),
          alertEmail: r.alertEmail,
        };

        // Console output as required by spec
        console.log(JSON.stringify(alertPayload, null, 2));
        logger.error(`[ALERT] ${JSON.stringify(alertPayload)}`);

        // Emit for AlertService to handle (email, webhook, etc.)
        this.emit('alert', { id, alertEmail: r.alertEmail, payload: alertPayload });
      }
    }, 1000);
  }

  _clearInterval(record) {
    if (record.intervalId) {
      clearInterval(record.intervalId);
      record.intervalId = null;
    }
  }

  _getOrThrow(id) {
    const record = this.monitors.get(id);
    if (!record) {
      const err = new Error(`Monitor not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }
    return record;
  }

  /** Strip internal fields before returning to callers */
  _toPublic(record) {
    return {
      id: record.id,
      status: record.status,
      timeout: record.timeout,
      remainingTime: record.remaining,
      alertEmail: record.alertEmail,
      lastHeartbeat: record.lastHeartbeat,
      createdAt: record.createdAt,
    };
  }
}

// Export a singleton so all parts of the app share the same timer state
module.exports = new TimerManager();
