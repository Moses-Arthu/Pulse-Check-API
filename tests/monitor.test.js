'use strict';

/**
 * ============================================================
 * Pulse-Check API – Integration Tests
 * Jest + Supertest
 * ============================================================
 *
 * Each describe block maps to a user story / acceptance criterion.
 * We use Jest fake timers to deterministically test timeout logic
 * without waiting real seconds.
 */

process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');

// ─── Helpers ────────────────────────────────────────────────────
const validBody = (overrides = {}) => ({
  id: `device-test-${Date.now()}`,
  timeout: 10,
  alert_email: 'admin@critmon.com',
  ...overrides,
});

// Clear all monitors between tests to avoid state bleed
beforeEach(() => {
  const timerManager = require('../src/services/TimerManager');
  // Clean up all existing monitors
  for (const [id] of timerManager.monitors) {
    try { timerManager.delete(id); } catch (_) { /* already gone */ }
  }
});

afterAll(() => {
  // Final cleanup
  const timerManager = require('../src/services/TimerManager');
  for (const [id] of timerManager.monitors) {
    try { timerManager.delete(id); } catch (_) {}
  }
});

// ================================================================
// GET /health
// ================================================================
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body.monitors).toHaveProperty('total');
  });
});

// ================================================================
// POST /monitors – Register Monitor
// ================================================================
describe('POST /monitors – Register Monitor', () => {
  it('201 – creates a monitor successfully', async () => {
    const body = validBody({ id: 'device-reg-01' });
    const res = await request(app).post('/monitors').send(body);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Monitor created successfully');
    expect(res.body.id).toBe('device-reg-01');
  });

  it('409 – duplicate ID is rejected', async () => {
    const body = validBody({ id: 'device-dup-01' });
    await request(app).post('/monitors').send(body);
    const res = await request(app).post('/monitors').send(body);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/);
  });

  it('400 – missing id', async () => {
    const { id, ...body } = validBody();
    const res = await request(app).post('/monitors').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/"id" is required/);
  });

  it('400 – timeout below minimum (< 5)', async () => {
    const res = await request(app)
      .post('/monitors')
      .send(validBody({ id: 'device-toofast', timeout: 3 }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 5/);
  });

  it('400 – invalid email', async () => {
    const res = await request(app)
      .post('/monitors')
      .send(validBody({ id: 'device-bademail', alert_email: 'not-an-email' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });

  it('400 – missing alert_email', async () => {
    const { alert_email, ...body } = validBody({ id: 'device-noemail' });
    const res = await request(app).post('/monitors').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/"alert_email" is required/);
  });
});

// ================================================================
// POST /monitors/:id/heartbeat – Heartbeat Reset
// ================================================================
describe('POST /monitors/:id/heartbeat – Heartbeat', () => {
  it('200 – resets an existing monitor', async () => {
    const id = 'device-hb-01';
    await request(app).post('/monitors').send(validBody({ id }));
    const res = await request(app).post(`/monitors/${id}/heartbeat`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Heartbeat received');
  });

  it('404 – unknown monitor', async () => {
    const res = await request(app).post('/monitors/unknown-device/heartbeat');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('updates lastHeartbeat timestamp', async () => {
    const id = 'device-hb-ts';
    await request(app).post('/monitors').send(validBody({ id }));
    await request(app).post(`/monitors/${id}/heartbeat`);
    const res = await request(app).get(`/monitors/${id}`);
    expect(res.body.monitor.lastHeartbeat).not.toBeNull();
  });
});

// ================================================================
// POST /monitors/:id/pause – Pause Monitoring
// ================================================================
describe('POST /monitors/:id/pause – Pause', () => {
  it('200 – pauses an active monitor', async () => {
    const id = 'device-pause-01';
    await request(app).post('/monitors').send(validBody({ id }));
    const res = await request(app).post(`/monitors/${id}/pause`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.monitor.status).toBe('paused');
  });

  it('409 – cannot pause an already-paused monitor', async () => {
    const id = 'device-pause-02';
    await request(app).post('/monitors').send(validBody({ id }));
    await request(app).post(`/monitors/${id}/pause`);
    const res = await request(app).post(`/monitors/${id}/pause`);
    expect(res.status).toBe(409);
  });

  it('404 – cannot pause unknown monitor', async () => {
    const res = await request(app).post('/monitors/ghost/pause');
    expect(res.status).toBe(404);
  });

  it('heartbeat auto-resumes a paused monitor', async () => {
    const id = 'device-resume-01';
    await request(app).post('/monitors').send(validBody({ id }));
    await request(app).post(`/monitors/${id}/pause`);

    // Status should now be paused
    const pausedRes = await request(app).get(`/monitors/${id}`);
    expect(pausedRes.body.monitor.status).toBe('paused');

    // Send heartbeat to resume
    await request(app).post(`/monitors/${id}/heartbeat`);
    const activeRes = await request(app).get(`/monitors/${id}`);
    expect(activeRes.body.monitor.status).toBe('active');
  });
});

// ================================================================
// GET /monitors – Dashboard
// ================================================================
describe('GET /monitors – Dashboard', () => {
  it('200 – returns all monitors with required fields', async () => {
    const id = 'device-dash-01';
    await request(app).post('/monitors').send(validBody({ id }));
    const res = await request(app).get('/monitors');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.monitors)).toBe(true);
    const found = res.body.monitors.find((m) => m.id === id);
    expect(found).toBeDefined();
    expect(found).toHaveProperty('id');
    expect(found).toHaveProperty('status');
    expect(found).toHaveProperty('timeout');
    expect(found).toHaveProperty('remainingTime');
    expect(found).toHaveProperty('lastHeartbeat');
    expect(found).toHaveProperty('createdAt');
  });

  it('count matches the number of monitors', async () => {
    await request(app).post('/monitors').send(validBody({ id: 'count-01' }));
    await request(app).post('/monitors').send(validBody({ id: 'count-02' }));
    const res = await request(app).get('/monitors');
    expect(res.body.count).toBe(res.body.monitors.length);
  });
});

// ================================================================
// GET /monitors/:id – Single Monitor
// ================================================================
describe('GET /monitors/:id – Single Monitor', () => {
  it('200 – returns the monitor', async () => {
    const id = 'device-single-01';
    await request(app).post('/monitors').send(validBody({ id }));
    const res = await request(app).get(`/monitors/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.monitor.id).toBe(id);
  });

  it('404 – unknown monitor', async () => {
    const res = await request(app).get('/monitors/no-such-device');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ================================================================
// DELETE /monitors/:id
// ================================================================
describe('DELETE /monitors/:id – Delete Monitor', () => {
  it('200 – deletes an existing monitor', async () => {
    const id = 'device-del-01';
    await request(app).post('/monitors').send(validBody({ id }));
    const res = await request(app).delete(`/monitors/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('404 – cannot get a deleted monitor', async () => {
    const id = 'device-del-02';
    await request(app).post('/monitors').send(validBody({ id }));
    await request(app).delete(`/monitors/${id}`);
    const res = await request(app).get(`/monitors/${id}`);
    expect(res.status).toBe(404);
  });

  it('404 – deleting unknown monitor', async () => {
    const res = await request(app).delete('/monitors/does-not-exist');
    expect(res.status).toBe(404);
  });
});

// ================================================================
// Timeout / Alert – Failure State
// ================================================================
describe('Timeout – Failure State', () => {
  jest.useFakeTimers();

  it('monitor status becomes "down" after timeout expires', async () => {
    const id = 'device-timeout-01';
    await request(app)
      .post('/monitors')
      .send({ id, timeout: 5, alert_email: 'admin@critmon.com' });

    // Advance fake clock past the 5-second timeout (5100ms)
    jest.advanceTimersByTime(5100);

    const res = await request(app).get(`/monitors/${id}`);
    expect(res.body.monitor.status).toBe('down');
    expect(res.body.monitor.remainingTime).toBe(0);
  });

  afterAll(() => jest.useRealTimers());
});

// ================================================================
// 404 – Unknown Routes
// ================================================================
describe('404 – Unknown Routes', () => {
  it('returns 404 for completely unknown path', async () => {
    const res = await request(app).get('/unknown-path');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/route not found/i);
  });
});
