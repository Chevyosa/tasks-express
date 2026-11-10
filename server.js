require('dotenv').config();

const logger = require('./utils/logger');

let pool;
let server;
let shuttingDown = false;

function closePool() {
  return pool ? pool.end().catch(() => logger.error('db.pool_close_failed')) : Promise.resolve();
}

function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('server.shutdown', { reason });
  if (exitCode) process.exitCode = exitCode;

  const finish = () => closePool().then(() => process.exit());
  if (!server) {
    finish();
    return;
  }
  server.close((error) => {
    if (error) process.exitCode = 1;
    finish();
  });
  // Do not hang forever on open keep-alive connections.
  setTimeout(() => process.exit(), 10000).unref();
}

async function start() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  // Loading these validates configuration (DB_* and JWT_*) without printing secret values.
  require('./config/auth').getAuthConfig();
  ({ pool } = require('./config/database'));
  const app = require('./app');

  try {
    await pool.query('SELECT 1');
  } catch {
    throw new Error('Unable to connect to the database: check DB_* settings and that MySQL is running.');
  }

  server = app.listen(port);
  server.on('listening', () => logger.info('server.listening', { port }));
  server.on('error', (error) => {
    logger.error('server.error', { code: error.code, message: error.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : error.message });
    shutdown('server_error', 1);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => {
  logger.error('process.unhandled_rejection', { name: error?.name, message: error?.message });
  shutdown('unhandled_rejection', 1);
});

start().catch((error) => {
  logger.error('server.start_failed', { message: error.message });
  shutdown('start_failed', 1);
});
