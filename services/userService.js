const { pool } = require('../config/database');
const { toIsoUtc } = require('./serializers');

function serializeUser(row) {
  if (!row) return null;
  return { id: Number(row.id), email: row.email, created_at: toIsoUtc(row.created_at) };
}

/** Returns the new public user, or `null` when the email is already registered. */
async function createUser(email, passwordHash) {
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())',
      [email, passwordHash],
    );
    return findPublicById(result.insertId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return null;
    throw error;
  }
}

/** The only query that reads `password_hash`. */
async function findByEmailForLogin(email) {
  const [rows] = await pool.execute(
    'SELECT id, password_hash, token_version FROM users WHERE email = ?',
    [email],
  );
  if (!rows[0]) return null;
  return { id: Number(rows[0].id), password_hash: rows[0].password_hash, token_version: Number(rows[0].token_version) };
}

async function findAuthById(id) {
  const [rows] = await pool.execute('SELECT id, token_version FROM users WHERE id = ?', [id]);
  if (!rows[0]) return null;
  return { id: Number(rows[0].id), token_version: Number(rows[0].token_version) };
}

async function findPublicById(id) {
  const [rows] = await pool.execute('SELECT id, email, created_at FROM users WHERE id = ?', [id]);
  return serializeUser(rows[0]);
}

/** Invalidates every access token previously issued to the user. */
async function incrementTokenVersion(id) {
  const [result] = await pool.execute(
    'UPDATE users SET token_version = token_version + 1, updated_at = UTC_TIMESTAMP() WHERE id = ?',
    [id],
  );
  return result.affectedRows > 0;
}

module.exports = { createUser, findByEmailForLogin, findAuthById, findPublicById, incrementTokenVersion };
