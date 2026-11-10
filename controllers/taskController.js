const service = require('../services/taskService');
const HttpError = require('../utils/httpError');
const {
  STATUSES,
  PRIORITIES,
  positiveInt,
  validDate,
  requireObjectBody,
} = require('../utils/validators');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MAX_QUERY_LENGTH = 100;

const notFound = () => new HttpError(404, 'TASK_NOT_FOUND', 'Tugas tidak ditemukan.');

function validateTask(body, partial = false) {
  requireObjectBody(body);
  const result = {};

  if (!partial || Object.hasOwn(body, 'title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 200) {
      throw new HttpError(400, 'INVALID_TITLE', 'title wajib berupa teks 1–200 karakter.');
    }
    result.title = title;
  }

  if (Object.hasOwn(body, 'description')) {
    if (body.description !== null && typeof body.description !== 'string') {
      throw new HttpError(400, 'INVALID_DESCRIPTION', 'description harus teks atau null.');
    }
    result.description = body.description;
  }

  if (Object.hasOwn(body, 'due_at')) result.due_at = validDate(body.due_at, 'due_at');

  if (Object.hasOwn(body, 'priority')) {
    if (!PRIORITIES.includes(body.priority)) {
      throw new HttpError(400, 'INVALID_PRIORITY', `priority harus salah satu: ${PRIORITIES.join(', ')}.`);
    }
    result.priority = body.priority;
  }

  if (partial && !Object.keys(result).length) {
    throw new HttpError(400, 'EMPTY_UPDATE', 'Tidak ada field yang dapat diperbarui.');
  }
  return result;
}

function parseListQuery(query) {
  const { status, priority, q } = query;
  if (status !== undefined && !STATUSES.includes(status)) {
    throw new HttpError(400, 'INVALID_STATUS', `Filter status harus salah satu: ${STATUSES.join(', ')}.`);
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    throw new HttpError(400, 'INVALID_PRIORITY', `Filter priority harus salah satu: ${PRIORITIES.join(', ')}.`);
  }
  if (q !== undefined && (typeof q !== 'string' || q.length > MAX_QUERY_LENGTH)) {
    throw new HttpError(400, 'INVALID_QUERY', `q harus teks maksimal ${MAX_QUERY_LENGTH} karakter.`);
  }

  const page = query.page === undefined ? 1 : positiveInt(query.page, 'page');
  const limit = query.limit === undefined ? DEFAULT_LIMIT : positiveInt(query.limit, 'limit');
  if (limit > MAX_LIMIT) throw new HttpError(400, 'INVALID_LIMIT', `limit maksimal ${MAX_LIMIT}.`);

  const due_after = query.due_after === undefined
    ? undefined
    : validDate(query.due_after, 'due_after', { nullable: false });
  const due_before = query.due_before === undefined
    ? undefined
    : validDate(query.due_before, 'due_before', { nullable: false, endOfDay: true });

  return { status, priority, q: q?.trim() || undefined, page, limit, due_after, due_before };
}

async function list(req, res) {
  const filters = parseListQuery(req.query);
  const { rows, total } = await service.list(req.user.id, filters);
  res.json({
    data: rows,
    meta: { page: filters.page, limit: filters.limit, total, total_pages: Math.ceil(total / filters.limit) },
  });
}

async function get(req, res) {
  const task = await service.findById(req.user.id, positiveInt(req.params.id, 'id'));
  if (!task) throw notFound();
  res.json({ data: task });
}

async function create(req, res) {
  const task = await service.create(req.user.id, validateTask(req.body));
  res.status(201).json({ data: task });
}

async function update(req, res) {
  const id = positiveInt(req.params.id, 'id');
  const task = await service.update(req.user.id, id, validateTask(req.body, true));
  if (!task) throw notFound();
  res.json({ data: task });
}

async function updateStatus(req, res) {
  const id = positiveInt(req.params.id, 'id');
  requireObjectBody(req.body);
  if (!STATUSES.includes(req.body.status)) {
    throw new HttpError(400, 'INVALID_STATUS', `status harus salah satu: ${STATUSES.join(', ')}.`);
  }
  const task = await service.updateStatus(req.user.id, id, req.body.status);
  if (!task) throw notFound();
  res.json({ data: task });
}

async function remove(req, res) {
  const deleted = await service.remove(req.user.id, positiveInt(req.params.id, 'id'));
  if (!deleted) throw notFound();
  res.status(204).end();
}

module.exports = { list, get, create, update, updateStatus, remove };
