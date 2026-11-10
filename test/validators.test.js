const test = require('node:test');
const assert = require('node:assert/strict');
const { validDate, validEmail, validPassword, positiveInt } = require('../utils/validators');

test('validDate converts offsets to UTC MySQL strings', () => {
  assert.equal(validDate('2026-11-13T17:00:00+07:00', 'due_at'), '2026-11-13 10:00:00');
  assert.equal(validDate('2026-11-13T10:00:00.123Z', 'due_at'), '2026-11-13 10:00:00');
  assert.equal(validDate('2026-11-13', 'due_at'), '2026-11-13 00:00:00');
  assert.equal(validDate('2026-11-13', 'due_before', { endOfDay: true }), '2026-11-13 23:59:59');
  assert.equal(validDate(null, 'due_at'), null);
});

test('validDate rejects impossible or ambiguous dates', () => {
  for (const value of ['2026-02-31', '2026-02-29', '2026-13-01', '2026-11-13T24:00:00Z',
    '2026-11-13T10:60:00Z', '2026-11-13T10:00:00', '2026-11-13T10:00:00+15:00', '13/11/2026', 20261113]) {
    assert.throws(() => validDate(value, 'due_at'), { code: 'INVALID_DATE' }, String(value));
  }
  assert.equal(validDate('2028-02-29', 'due_at'), '2028-02-29 00:00:00');
  assert.throws(() => validDate(null, 'due_after', { nullable: false }), { code: 'INVALID_DATE' });
});

test('validEmail normalizes and bounds input', () => {
  assert.equal(validEmail('  User@Example.COM '), 'user@example.com');
  for (const value of ['no-at-sign', 'a@b', `${'a'.repeat(65)}@example.com`, `a@${'b'.repeat(250)}.com`, null]) {
    assert.throws(() => validEmail(value), { code: 'INVALID_EMAIL' });
  }
});

test('validPassword enforces 12-128 characters without trimming', () => {
  assert.equal(validPassword('correct horse battery'), 'correct horse battery');
  for (const value of ['short', 'a'.repeat(129), 123456789012, undefined]) {
    assert.throws(() => validPassword(value), { code: 'INVALID_PASSWORD' });
  }
});

test('positiveInt rejects zero, negatives, decimals, and huge values', () => {
  assert.equal(positiveInt('42', 'id'), 42);
  for (const value of ['0', '-1', '1.5', 'abc', '9007199254740993', ['1', '2']]) {
    assert.throws(() => positiveInt(value, 'id'), { code: 'INVALID_PARAMETER' });
  }
});
