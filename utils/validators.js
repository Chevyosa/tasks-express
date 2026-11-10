const HttpError = require('./httpError');

const STATUSES = ['pending', 'in_progress', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const EMAIL_MAX = 254;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2})))?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function positiveInt(value, name) {
  const text = String(value);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < 1) {
    throw new HttpError(400, 'INVALID_PARAMETER', `${name} harus berupa bilangan bulat positif.`);
  }
  return Number(text);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Validate an ISO 8601 date (`YYYY-MM-DD`) or date-time with an explicit offset
 * (`YYYY-MM-DDTHH:MM:SS[.mmm](Z|±HH:MM)`) and return a UTC `YYYY-MM-DD HH:MM:SS` string for MySQL.
 * Date-only input is interpreted as UTC midnight, or 23:59:59 UTC when `endOfDay` is true.
 */
function validDate(value, name, { nullable = true, endOfDay = false } = {}) {
  if (value === null && nullable) return null;
  const invalid = () => new HttpError(400, 'INVALID_DATE', `${name} harus tanggal ISO 8601 yang valid.`);
  if (typeof value !== 'string') throw invalid();

  const match = DATE_PATTERN.exec(value);
  if (!match) throw invalid();

  const [, y, mo, d, h, mi, s, zone, sign, offH, offM] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw invalid();

  if (h === undefined) {
    const time = endOfDay ? '23:59:59' : '00:00:00';
    return `${y}-${mo}-${d} ${time}`;
  }

  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) throw invalid();
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    if (Number(offH) > 14 || Number(offM) > 59) throw invalid();
    offsetMinutes = (Number(offH) * 60 + Number(offM)) * (sign === '-' ? -1 : 1);
  }

  const utcMs = Date.UTC(year, month - 1, day, Number(h), Number(mi), Number(s)) - offsetMinutes * 60000;
  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) throw invalid();
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function validEmail(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_EMAIL', 'email wajib berupa alamat email yang valid.');
  }
  const email = value.trim().toLowerCase();
  const local = email.split('@')[0];
  if (email.length > EMAIL_MAX || local.length > 64 || !EMAIL_PATTERN.test(email)) {
    throw new HttpError(400, 'INVALID_EMAIL', 'email wajib berupa alamat email yang valid.');
  }
  return email;
}

function validPassword(value) {
  const length = typeof value === 'string' ? [...value].length : 0;
  if (typeof value !== 'string' || length < PASSWORD_MIN || length > PASSWORD_MAX) {
    throw new HttpError(
      400,
      'INVALID_PASSWORD',
      `password wajib berupa teks ${PASSWORD_MIN}–${PASSWORD_MAX} karakter.`,
    );
  }
  return value;
}

function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_BODY', 'Body harus berupa objek JSON.');
  }
  return body;
}

module.exports = {
  STATUSES,
  PRIORITIES,
  PASSWORD_MIN,
  PASSWORD_MAX,
  positiveInt,
  validDate,
  validEmail,
  validPassword,
  requireObjectBody,
};
