module.exports = (error, _req, res, _next) => {
  if (res.headersSent) return;

  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      error: { code: error.code || 'REQUEST_ERROR', message: error.message },
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Format JSON tidak valid.' } });
  }

  console.error(error);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' },
  });
};
