const userService = require('../services/userService');
const HttpError = require('../utils/httpError');
const logger = require('../utils/logger');
const { hashPassword, verifyPassword, getDummyHash } = require('../utils/password');
const { signAccessToken } = require('../utils/token');
const { validEmail, validPassword, requireObjectBody } = require('../utils/validators');

function tokenResponse(user, tokenVersion) {
  const { token, expiresIn } = signAccessToken({ id: user.id, token_version: tokenVersion });
  return { token, token_type: 'Bearer', expires_in: expiresIn, user };
}

async function register(req, res) {
  requireObjectBody(req.body);
  const email = validEmail(req.body.email);
  const password = validPassword(req.body.password);

  const user = await userService.createUser(email, await hashPassword(password));
  if (!user) {
    logger.security('auth.register_conflict', { ip: req.ip });
    throw new HttpError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar.');
  }

  logger.security('auth.register', { userId: user.id, ip: req.ip });
  res.status(201).json({ data: tokenResponse(user, 0) });
}

async function login(req, res) {
  requireObjectBody(req.body);
  const invalid = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah.');

  // Malformed credentials get the same answer as wrong ones.
  let email;
  try {
    email = validEmail(req.body.email);
  } catch {
    throw invalid();
  }
  const password = typeof req.body.password === 'string' && req.body.password.length <= 128
    ? req.body.password
    : null;

  const account = await userService.findByEmailForLogin(email);
  // Always run one scrypt verification so response time does not reveal registered emails.
  const ok = await verifyPassword(password ?? '', account ? account.password_hash : await getDummyHash());
  if (!account || !password || !ok) {
    logger.security('auth.login_failed', { userId: account ? account.id : undefined, ip: req.ip });
    throw invalid();
  }

  const user = await userService.findPublicById(account.id);
  logger.security('auth.login', { userId: account.id, ip: req.ip });
  res.json({ data: tokenResponse(user, account.token_version) });
}

async function me(req, res) {
  const user = await userService.findPublicById(req.user.id);
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'Autentikasi diperlukan.');
  res.json({ data: user });
}

async function logout(req, res) {
  await userService.incrementTokenVersion(req.user.id);
  logger.security('auth.logout', { userId: req.user.id, ip: req.ip });
  res.status(204).end();
}

module.exports = { register, login, me, logout };
