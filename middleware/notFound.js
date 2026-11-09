module.exports = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
};
