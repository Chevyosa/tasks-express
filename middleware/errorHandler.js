const HttpError = require('../utils/httpError');
const logger = require('../utils/logger');

function send(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  // Body-parser errors carry status 400/413/415; handle them before the generic 4xx branch.
  if (error.type === 'entity.parse.failed') {
    return send(res, 400, 'INVALID_JSON', 'Format JSON tidak valid.');
  }
  if (error.type === 'entity.too.large') {
    return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Ukuran body melebihi batas.');
  }

  // Only our own errors expose their message to the client.
  if (error instanceof HttpError) {
    return send(res, error.status, error.code, error.message);
  }

  const status = Number.isInteger(error.status) ? error.status : error.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return send(res, status, 'REQUEST_ERROR', 'Permintaan tidak dapat diproses.');
  }

  logger.error('request.failed', {
    method: req.method,
    path: req.path,
    name: error.name,
    code: error.code,
    message: error.message,
  });
  return send(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.');
};
