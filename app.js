const express = require('express');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

/**
 * TRUST_PROXY: `false` (default, direct connections), a hop count such as `1`,
 * or an Express preset such as `loopback`. Needed for correct client IPs behind a reverse proxy.
 */
function parseTrustProxy(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value || value === 'false') return false;
  if (value === 'true') return 1;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.status(200).json({ data: { status: 'ok' } }));
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
