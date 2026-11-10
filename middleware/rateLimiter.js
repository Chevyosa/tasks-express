const { rateLimit } = require('express-rate-limit');
const logger = require('../utils/logger');

// In-memory store: fine for a single process. Use a shared store if you run several instances.
function limiter({ windowMs, limit, event }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      if (event) logger.security(event, { ip: req.ip });
      res.status(429).json({
        error: { code: 'TOO_MANY_REQUESTS', message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
      });
    },
  });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

module.exports = {
  apiLimiter: limiter({ windowMs: FIFTEEN_MINUTES, limit: 300 }),
  loginLimiter: limiter({ windowMs: FIFTEEN_MINUTES, limit: 10, event: 'auth.login_rate_limited' }),
  registerLimiter: limiter({ windowMs: ONE_HOUR, limit: 5, event: 'auth.register_rate_limited' }),
};
