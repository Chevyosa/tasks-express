const userService = require('../services/userService');
const HttpError = require('../utils/httpError');
const logger = require('../utils/logger');
const { verifyAccessToken } = require('../utils/token');

const MAX_TOKEN_LENGTH = 2048;

function unauthorized() {
  return new HttpError(401, 'UNAUTHORIZED', 'Autentikasi diperlukan atau token tidak valid.');
}

/** Requires `Authorization: Bearer <token>`. Fails closed on any problem. */
async function authenticate(req, res, next) {
  res.set('WWW-Authenticate', 'Bearer');
  const header = req.get('authorization') || '';
  const match = /^Bearer ([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(header);
  if (!match || match[1].length > MAX_TOKEN_LENGTH) throw unauthorized();

  const claims = verifyAccessToken(match[1]);
  if (!claims) {
    logger.security('auth.token_rejected', { ip: req.ip });
    throw unauthorized();
  }

  const user = await userService.findAuthById(claims.userId);
  if (!user || user.token_version !== claims.version) {
    logger.security('auth.token_revoked', { userId: claims.userId, ip: req.ip });
    throw unauthorized();
  }

  res.removeHeader('WWW-Authenticate');
  req.user = { id: user.id };
  next();
}

module.exports = authenticate;
