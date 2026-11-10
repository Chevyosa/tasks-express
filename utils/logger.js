/**
 * Minimal structured logging. Never pass passwords, tokens, secrets, or request bodies here.
 */
function write(level, event, details = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...details });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

module.exports = {
  info: (event, details) => write('info', event, details),
  warn: (event, details) => write('warn', event, details),
  error: (event, details) => write('error', event, details),
  /** Security-relevant event (login, register, logout, rejected token). */
  security: (event, details) => write('security', event, details),
};
