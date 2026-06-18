'use strict';

const request = require('supertest');
const app     = require('../app');

// ─── DevSecOps Demo API — Endpoint Tests ─────────────────────────────────────

// ── GET / ─────────────────────────────────────────────────────────────────────
describe('GET /', () => {
  it('returns HTTP 200', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  it('returns the API welcome message', async () => {
    const res = await request(app).get('/');
    expect(res.body).toEqual({ message: 'DevSecOps Demo API' });
  });

  it('responds with JSON content-type', async () => {
    const res = await request(app).get('/');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── GET /health ───────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns HTTP 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('returns status UP', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'UP' });
  });

  it('responds with JSON content-type', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ── GET /version ──────────────────────────────────────────────────────────────
describe('GET /version', () => {
  afterEach(() => {
    delete process.env.APP_VERSION;
  });

  it('returns HTTP 200', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
  });

  it('returns a version property', async () => {
    const res = await request(app).get('/version');
    expect(res.body).toHaveProperty('version');
  });

  it('returns a valid semantic version string (x.y.z)', async () => {
    const res = await request(app).get('/version');
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('version has exactly three dot-separated parts', async () => {
    const res = await request(app).get('/version');
    expect(res.body.version.split('.')).toHaveLength(3);
  });

  it('falls back to 1.0.0 when APP_VERSION format is invalid', async () => {
    process.env.APP_VERSION = 'badversion';
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.0.0');
  });

  it('honours a custom APP_VERSION env variable', async () => {
    process.env.APP_VERSION = '2.3.4';
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('2.3.4');
  });
});

// ── 404 Handling ─────────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('returns 404 for GET /unknown', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(404);
  });

  it('returns a JSON error body for unmatched routes', async () => {
    const res = await request(app).get('/does/not/exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
// Trigger the centralized error middleware by sending a request body that
// exceeds the 10 KB limit configured in express.json({ limit: '10kb' }).
// Express emits a 413 PayloadTooLargeError which is caught by the error handler.
describe('Centralized error handler', () => {
  it('returns 413 and JSON body for an oversized payload (dev mode)', async () => {
    const bigBody = JSON.stringify({ data: 'x'.repeat(20 * 1024) });
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(bigBody);
    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty('error');
  });

  it('returns a generic message when NODE_ENV is production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const bigBody = JSON.stringify({ data: 'x'.repeat(20 * 1024) });
    const res = await request(app)
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(bigBody);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('Internal Server Error');
    process.env.NODE_ENV = originalEnv;
  });
});

// ── Security Headers (Helmet) ─────────────────────────────────────────────────
describe('Security headers (Helmet)', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options to deny clickjacking', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('sets X-DNS-Prefetch-Control header', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });
});
