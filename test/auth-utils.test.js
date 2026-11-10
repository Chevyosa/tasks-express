const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.JWT_EXPIRES_IN = '15m';

const { getAuthConfig, resetAuthConfigForTests } = require('../config/auth');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccessToken, verifyAccessToken } = require('../utils/token');

test('hashPassword produces salted scrypt hashes that verify', async () => {
  const hash = await hashPassword('correct horse battery');
  assert.match(hash, /^scrypt\$131072\$8\$1\$/);
  assert.notEqual(hash, await hashPassword('correct horse battery'));
  assert.equal(await verifyPassword('correct horse battery', hash), true);
  assert.equal(await verifyPassword('wrong horse battery', hash), false);
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
});

test('valid tokens round-trip', () => {
  const { token, expiresIn } = signAccessToken({ id: 7, token_version: 3 });
  assert.equal(expiresIn, 900);
  assert.deepEqual(verifyAccessToken(token), { userId: 7, version: 3 });
});

test('tampered, unsigned, foreign, and expired tokens are rejected', () => {
  const { secret, issuer, audience } = getAuthConfig();
  const base = { ver: 0 };
  const opts = { subject: '1', issuer, audience };

  const none = jwt.sign(base, null, { ...opts, algorithm: 'none' });
  const otherSecret = jwt.sign(base, 'another-secret-another-secret-another', { ...opts, algorithm: 'HS256' });
  const hs512 = jwt.sign(base, secret, { ...opts, algorithm: 'HS512' });
  const wrongAudience = jwt.sign(base, secret, { ...opts, audience: 'other', algorithm: 'HS256' });
  const wrongIssuer = jwt.sign(base, secret, { ...opts, issuer: 'other', algorithm: 'HS256' });
  const expired = jwt.sign({ ...base, exp: Math.floor(Date.now() / 1000) - 10 }, secret, { ...opts, algorithm: 'HS256' });
  const badSubject = jwt.sign(base, secret, { ...opts, subject: 'abc', algorithm: 'HS256' });
  const noVersion = jwt.sign({}, secret, { ...opts, algorithm: 'HS256' });

  const { token } = signAccessToken({ id: 1, token_version: 0 });
  const [h, p, s] = token.split('.');
  const flipped = `${h}.${p}.${s.slice(0, -2)}${s.endsWith('AA') ? 'BB' : 'AA'}`;

  for (const bad of [none, otherSecret, hs512, wrongAudience, wrongIssuer, expired, badSubject, noVersion, flipped, 'garbage']) {
    assert.equal(verifyAccessToken(bad), null);
  }
});

test('auth config rejects short secrets and bad lifetimes', () => {
  const saved = { ...process.env };
  try {
    for (const [secret, expires] of [['short', '1h'], [undefined, '1h'], [saved.JWT_SECRET, 'forever'], [saved.JWT_SECRET, '30d']]) {
      resetAuthConfigForTests();
      if (secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret;
      process.env.JWT_EXPIRES_IN = expires;
      assert.throws(() => getAuthConfig());
    }
  } finally {
    process.env.JWT_SECRET = saved.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = saved.JWT_EXPIRES_IN;
    resetAuthConfigForTests();
  }
});
