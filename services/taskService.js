const { pool } = require('../config/database');
const { serializeTask } = require('./serializers');

const COLUMNS = 'id, title, description, status, priority, due_at, completed_at, created_at, updated_at';

// Whitelist of updatable columns; keys come from validated input, never raw user strings.
const UPDATABLE = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  due_at: 'due_at',
};

// '!' is used as the LIKE escape character so behaviour does not depend on NO_BACKSLASH_ESCAPES.
function escapeLike(text) {
  return text.replace(/[!%_]/g, (char) => `!${char}`);
}

async function list(userId, filters) {
  const where = ['user_id = ?'];
  const values = [userId];
  if (filters.status) { where.push('status = ?'); values.push(filters.status); }
  if (filters.priority) { where.push('priority = ?'); values.push(filters.priority); }
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    where.push("(title LIKE ? ESCAPE '!' OR description LIKE ? ESCAPE '!')");
    values.push(pattern, pattern);
  }
  if (filters.due_after) { where.push('due_at >= ?'); values.push(filters.due_after); }
  if (filters.due_before) { where.push('due_at <= ?'); values.push(filters.due_before); }
  const clause = `WHERE ${where.join(' AND ')}`;

  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM tasks ${clause}`, values);
  // LIMIT/OFFSET are bound as strings: MySQL 8.0.22+ rejects numeric prepared-statement
  // arguments here ("Incorrect arguments to mysqld_stmt_execute").
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS} FROM tasks ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...values, String(filters.limit), String((filters.page - 1) * filters.limit)],
  );
  return { rows: rows.map(serializeTask), total: Number(countRows[0].total) };
}

async function findById(userId, id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM tasks WHERE id = ? AND user_id = ?`, [id, userId]);
  return serializeTask(rows[0]);
}

async function create(userId, task) {
  const [result] = await pool.execute(
    `INSERT INTO tasks (user_id, title, description, priority, due_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [userId, task.title, task.description ?? null, task.priority || 'medium', task.due_at ?? null],
  );
  return findById(userId, result.insertId);
}

async function update(userId, id, changes) {
  const entries = Object.entries(changes).filter(([key]) => Object.hasOwn(UPDATABLE, key));
  if (!entries.length) return findById(userId, id);
  const assignments = entries.map(([key]) => `${UPDATABLE[key]} = ?`);
  const values = entries.map(([, value]) => value);
  assignments.push('updated_at = UTC_TIMESTAMP()');
  const [result] = await pool.execute(
    `UPDATE tasks SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`,
    [...values, id, userId],
  );
  return result.affectedRows ? findById(userId, id) : null;
}

async function updateStatus(userId, id, status) {
  // Only a fixed SQL fragment is chosen here; `status` itself is bound as a value.
  const completedAt = status === 'completed' ? 'UTC_TIMESTAMP()' : 'NULL';
  const [result] = await pool.execute(
    `UPDATE tasks SET status = ?, completed_at = ${completedAt}, updated_at = UTC_TIMESTAMP()
     WHERE id = ? AND user_id = ?`,
    [status, id, userId],
  );
  return result.affectedRows ? findById(userId, id) : null;
}

async function remove(userId, id) {
  const [result] = await pool.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows > 0;
}

module.exports = { list, findById, create, update, updateStatus, remove, escapeLike };
