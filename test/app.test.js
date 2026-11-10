// HTTP-level checks that never reach the database: the pool is created but never used.
const test = require('node:test');
const assert = require('node:assert/strict');

Object.assign(process.env, {
  DB_HOST: '127.0.0.1',
  DB_USER: 'unused',
  DB_NAME: 'unused',
  JWT_SECRET: 'test-secret-that-is-definitely-longer-than-32-chars',
});

const app = require('../app');
const { pool } = require('../config/database');
const { serializeTask } = require('../services/serializers');
const { escapeLike } = require('../services/taskService');

let server;
let base;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('task routes require a bearer token', async () => {
  for (const headers of [{}, { authorization: 'Bearer nope' }, { authorization: 'Basic abc' },
    { authorization: 'Bearer aaa.bbb.ccc' }]) {
    const res = await fetch(`${base}/api/v1/tasks`, { headers });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    assert.equal((await res.json()).error.code, 'UNAUTHORIZED');
  }
});

test('malformed JSON returns INVALID_JSON without parser details', async () => {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"email": ',
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: { code: 'INVALID_JSON', message: 'Format JSON tidak valid.' } });
});

test('oversized bodies return 413', async () => {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) }),
  });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('register validates input before touching the database', async () => {
  const res = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'short' }),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_PASSWORD');
});

test('unknown routes return 404 and security headers are set', async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('serializeTask returns ISO 8601 UTC dates', () => {
  const task = serializeTask({
    id: '5', title: 't', description: null, status: 'pending', priority: 'low',
    due_at: '2026-11-13 10:00:00', completed_at: null,
    created_at: '2026-11-10 01:02:03', updated_at: '2026-11-10 01:02:03',
  });
  assert.equal(task.id, 5);
  assert.equal(task.due_at, '2026-11-13T10:00:00Z');
  assert.equal(task.completed_at, null);
});

test('escapeLike neutralizes LIKE wildcards', () => {
  assert.equal(escapeLike('50%_off!'), '50!%!_off!!');
});
