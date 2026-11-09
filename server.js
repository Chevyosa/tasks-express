require('dotenv').config();

const app = require('./app');
const { pool } = require('./config/database');

const port = Number(process.env.PORT || 3000);

async function start() {
  try {
    await pool.query('SELECT 1');
    const server = app.listen(port, () => {
      console.log(`Task API listening on port ${port}`);
    });

    let shuttingDown = false;
    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`${signal} received; shutting down`);
      server.close(async (error) => {
        try {
          await pool.end();
        } catch (closeError) {
          console.error('Failed to close database pool');
          process.exitCode = 1;
        }
        if (error) process.exitCode = 1;
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Unable to start: check database configuration and availability.');
    await pool.end().catch(() => {});
    process.exitCode = 1;
  }
}

start();
