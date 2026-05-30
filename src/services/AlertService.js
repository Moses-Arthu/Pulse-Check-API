'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../config/logger');
const timerManager = require('./TimerManager');

/**
 * AlertService – Developer's Choice Feature
 *
 * Listens to TimerManager "alert" events and dispatches notifications.
 * Primary channel: email via nodemailer (SMTP).
 * Fallback: console + Winston log (always active).
 *
 * Why this was added:
 *   Support engineers need more than a console log when a device goes down.
 *   Real-world deployments require push notifications. Email alerts ensure
 *   that the on-call team is notified even when they are not watching logs.
 */
class AlertService {
  constructor() {
    this.transporter = null;
    this._initTransporter();
    this._bindEvents();
  }

  _initTransporter() {
    if (config.email.host && config.email.user && config.email.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
      logger.info('[AlertService] Email transporter initialised.');
    } else {
      logger.warn('[AlertService] Email credentials not configured – alerts will be console-only.');
    }
  }

  _bindEvents() {
    timerManager.on('alert', (data) => {
      this._handleAlert(data);
    });
  }

  async _handleAlert({ id, alertEmail, payload }) {
    logger.error(`[AlertService] FIRING ALERT for device: ${id}`);

    if (this.transporter && alertEmail) {
      try {
        await this.transporter.sendMail({
          from: config.email.from,
          to: alertEmail,
          subject: `🚨 ALERT: Device ${id} is DOWN!`,
          text: [
            `Watchdog Sentinel detected a missed heartbeat.`,
            ``,
            `Device ID : ${id}`,
            `Status    : DOWN`,
            `Time      : ${payload.time}`,
            ``,
            `Please deploy a repair team immediately.`,
            ``,
            `— CritMon Watchdog Sentinel`,
          ].join('\n'),
          html: `
            <h2 style="color:#e53e3e;">🚨 Device Down Alert</h2>
            <p><strong>Device ID:</strong> ${id}</p>
            <p><strong>Status:</strong> <span style="color:#e53e3e;">DOWN</span></p>
            <p><strong>Time:</strong> ${payload.time}</p>
            <hr/>
            <p>Please deploy a repair team immediately.</p>
            <small>— CritMon Watchdog Sentinel</small>
          `,
        });
        logger.info(`[AlertService] Email alert sent to ${alertEmail} for device ${id}`);
      } catch (err) {
        logger.error(`[AlertService] Failed to send email: ${err.message}`);
      }
    }
  }
}

// Instantiate once to start listening on import
module.exports = new AlertService();
