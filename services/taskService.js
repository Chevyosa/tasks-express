const { pool } = require('../config/database');

const fields = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  due_at: 'due_at',
};

async function list(filters) {
  const where = [];
  const values = [];
  if (filters.status) { where.push('status = ?'); values.push(filters.status); }
  if (filters.priority) { where.push('priority = ?'); values.push(filters.priority); }
  if (filters.q) {
    where.push('(title LIKE ? OR description LIKE ?)');
    values.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.due_after) { where.push('due_at >= ?'); values.push(filters.due_after); }
  if (filters.due_before) { where.push('due_at <= ?'); values.push(filters.due_before); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM tasks ${clause}`, values);
  const [rows] = await pool.execute(
    `SELECT * FROM tasks ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...values, filters.limit, (filters.page - 1) * filters.limit],
  );
  return { rows, total: Number(countRows[0].total) };
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(task) {
  const [result] = await pool.execute(
    'INSERT INTO tasks (title, description, priority, due_at, created_at, updated_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())',
    [task.title, task.description ?? null, task.priority || 'medium', task.due_at ?? null],
  );
  return findById(result.insertId);
}

async function update(id, changes) {
  const entries = Object.entries(changes).filter(([key]) => fields[key]);
  if (!entries.length) return findById(id);
  const assignments = entries.map(([key]) => `${fields[key]} = ?`);
  const values = entries.map(([, value]) => value);
  assignments.push('updated_at = UTC_TIMESTAMP()');
  values.push(id);
  const [result] = await pool.execute(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`, values);
  return result.affectedRows ? findById(id) : null;
}

async function updateStatus(id, status) {
  const [result] = await pool.execute(
    `UPDATE tasks SET status = ?, completed_at = ${status === 'completed' ? 'UTC_TIMESTAMP()' : 'NULL'}, updated_at = UTC_TIMESTAMP() WHERE id = ?`,
    [status, id],
  );
  return result.affectedRows ? findById(id) : null;
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { list, findById, create, update, updateStatus, remove };
