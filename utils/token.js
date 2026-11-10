const jwt = require('jsonwebtoken');
const { getAuthConfig } = require('../config/auth');

function signAccessToken(user) {
  const { secret, expiresInSeconds, issuer, audience, algorithm } = getAuthConfig();
  const token = jwt.sign({ ver: user.token_version }, secret, {
    algorithm,
    expiresIn: expiresInSeconds,
    issuer,
    audience,
    subject: String(user.id),
  });
  return { token, expiresIn: expiresInSeconds };
}

/**
 * Returns `{ userId, version }` for a valid token, or `null` for anything else.
 * The algorithm is pinned so `none` and algorithm-confusion tokens are rejected.
 */
function verifyAccessToken(token) {
  const { secret, issuer, audience, algorithm } = getAuthConfig();
  try {
    const payload = jwt.verify(token, secret, { algorithms: [algorithm], issuer, audience });
    if (typeof payload.sub !== 'string' || !/^[1-9]\d*$/.test(payload.sub)) return null;
    if (!Number.isSafeInteger(payload.ver) || payload.ver < 0) return null;
    const userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId)) return null;
    return { userId, version: payload.ver };
  } catch {
    return null;
  }
}

module.exports = { signAccessToken, verifyAccessToken };
