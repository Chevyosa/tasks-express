const service = require('../services/taskService');
const statuses = ['pending', 'in_progress', 'completed'];
const priorities = ['low', 'medium', 'high'];

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function positiveInt(value, name) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw new HttpError(400, 'INVALID_PARAMETER', `${name} harus berupa bilangan bulat positif.`);
  }
  return Number(value);
}

function validDate(value, name, nullable = true) {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, 'INVALID_DATE', `${name} harus tanggal ISO 8601 yang valid.`);
  }
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toISOString().slice(0, 19).replace('T', ' ');
}

function validateTask(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'INVALID_BODY', 'Body harus berupa objek JSON.');
  const result = {};
  if (!partial || Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) throw new HttpError(400, 'INVALID_TITLE', 'title wajib berupa teks 1–200 karakter.');
    result.title = body.title.trim();
  }
  for (const key of ['description', 'due_at', 'priority', 'status']) {
    if (!Object.hasOwn(body, key)) continue;
    if (key === 'description') {
      if (body[key] !== null && typeof body[key] !== 'string') throw new HttpError(400, 'INVALID_DESCRIPTION', 'description harus teks atau null.');
      result[key] = body[key];
    } else if (key === 'due_at') {
      result[key] = validDate(body[key], key);
    } else if (key === 'priority') {
      if (!priorities.includes(body[key])) throw new HttpError(400, 'INVALID_PRIORITY', `priority harus salah satu: ${priorities.join(', ')}.`);
      result[key] = body[key];
    } else {
      if (!statuses.includes(body[key])) throw new HttpError(400, 'INVALID_STATUS', `status harus salah satu: ${statuses.join(', ')}.`);
      result[key] = body[key];
    }
  }
  if (partial && Object.hasOwn(result, 'status')) delete result.status;
  if (partial && !Object.keys(result).length) throw new HttpError(400, 'EMPTY_UPDATE', 'Tidak ada field yang dapat diperbarui.');
  return result;
}

async function list(req, res) {
  const { status, priority, q } = req.query;
  if (status && !statuses.includes(status)) throw new HttpError(400, 'INVALID_STATUS', 'Filter status tidak valid.');
  if (priority && !priorities.includes(priority)) throw new HttpError(400, 'INVALID_PRIORITY', 'Filter priority tidak valid.');
  if (q !== undefined && (typeof q !== 'string' || q.length > 100)) throw new HttpError(400, 'INVALID_QUERY', 'q maksimal 100 karakter.');
  const page = req.query.page === undefined ? 1 : positiveInt(req.query.page, 'page');
  const limit = req.query.limit === undefined ? 20 : positiveInt(req.query.limit, 'limit');
  if (limit > 100) throw new HttpError(400, 'INVALID_LIMIT', 'limit maksimal 100.');
  const filters = {
    status, priority, q: q?.trim() || undefined, page, limit,
    due_after: req.query.due_after === undefined ? undefined : validDate(req.query.due_after, 'due_after', false),
    due_before: req.query.due_before === undefined ? undefined : validDate(req.query.due_before, 'due_before', false),
  };
  const { rows, total } = await service.list(filters);
  res.json({ data: rows, meta: { page, limit, total, total_pages: Math.ceil(total / limit) } });
}

async function get(req, res) {
  const task = await service.findById(positiveInt(req.params.id, 'id'));
  if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', 'Tugas tidak ditemukan.');
  res.json({ data: task });
}

async function create(req, res) {
  const task = await service.create(validateTask(req.body));
  res.status(201).json({ data: task });
}

async function update(req, res) {
  const changes = validateTask(req.body, true);
  const task = await service.update(positiveInt(req.params.id, 'id'), changes);
  if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', 'Tugas tidak ditemukan.');
  res.json({ data: task });
}

async function updateStatus(req, res) {
  if (!req.body || !statuses.includes(req.body.status)) throw new HttpError(400, 'INVALID_STATUS', `status harus salah satu: ${statuses.join(', ')}.`);
  const task = await service.updateStatus(positiveInt(req.params.id, 'id'), req.body.status);
  if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', 'Tugas tidak ditemukan.');
  res.json({ data: task });
}

async function remove(req, res) {
  const deleted = await service.remove(positiveInt(req.params.id, 'id'));
  if (!deleted) throw new HttpError(404, 'TASK_NOT_FOUND', 'Tugas tidak ditemukan.');
  res.status(204).end();
}

module.exports = { list, get, create, update, updateStatus, remove, HttpError };
