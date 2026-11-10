/**
 * The pool uses `dateStrings: true` and `timezone: 'Z'`, so DATETIME values arrive as
 * UTC `YYYY-MM-DD HH:MM:SS` strings. The API always returns ISO 8601 UTC (`...Z`).
 */
function toIsoUtc(value) {
  if (value === null || value === undefined) return null;
  return `${String(value).replace(' ', 'T')}Z`;
}

function serializeTask(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    due_at: toIsoUtc(row.due_at),
    completed_at: toIsoUtc(row.completed_at),
    created_at: toIsoUtc(row.created_at),
    updated_at: toIsoUtc(row.updated_at),
  };
}

module.exports = { toIsoUtc, serializeTask };
