const ISSUER = 'tasks-express';
const AUDIENCE = 'tasks-express-api';
const ALGORITHM = 'HS256';
const MIN_SECRET_LENGTH = 32;
const MAX_EXPIRES_SECONDS = 24 * 60 * 60;
const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 };

let cached;

function parseExpires(raw) {
  const match = /^(\d+)([smhd])?$/.exec(String(raw).trim());
  if (!match) return null;
  const seconds = Number(match[1]) * UNIT_SECONDS[match[2] || 's'];
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > MAX_EXPIRES_SECONDS) return null;
  return seconds;
}

/** Validate auth settings once. Secret values are never included in error messages. */
function getAuthConfig() {
  if (cached) return cached;

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters.`);
  }

  const expiresInSeconds = parseExpires(process.env.JWT_EXPIRES_IN || '1h');
  if (!expiresInSeconds) {
    throw new Error('JWT_EXPIRES_IN must look like 900, 15m, 1h, or 1d (between 1 minute and 1 day).');
  }

  cached = Object.freeze({ secret, expiresInSeconds, issuer: ISSUER, audience: AUDIENCE, algorithm: ALGORITHM });
  return cached;
}

function resetAuthConfigForTests() {
  cached = undefined;
}

module.exports = { getAuthConfig, resetAuthConfigForTests };
