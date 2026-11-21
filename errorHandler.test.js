const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../middleware/AppError');
const errorHandler = require('../middleware/errorHandler');

function handle(error) {
  const result = { status: null, body: null };
  const response = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; }
  };
  errorHandler(error, {}, response, () => {});
  return result;
}

test('operational database 503 preserves its meaningful message', () => {
  const result = handle(new AppError(503, 'The database is temporarily unavailable. Please try again shortly.'));
  assert.equal(result.status, 503);
  assert.equal(result.body.message, 'The database is temporarily unavailable. Please try again shortly.');
  assert.equal(result.body.success, false);
});

test('malformed JSON is a clear client error', () => {
  const error = new SyntaxError('parser detail');
  error.type = 'entity.parse.failed';
  const result = handle(error);
  assert.equal(result.status, 400);
  assert.equal(result.body.message, 'The request body must contain valid JSON.');
});

test('oversized JSON is a clear client error', () => {
  const error = new Error('too large');
  error.type = 'entity.too.large';
  const result = handle(error);
  assert.equal(result.status, 400);
  assert.equal(result.body.message, 'The request body is too large.');
});

test('unexpected internal errors hide implementation details from the response', () => {
  const result = handle(new Error('secret SQL detail'));
  assert.equal(result.status, 500);
  assert.equal(result.body.message, 'An unexpected server error occurred.');
  assert.equal(result.body.details.error, 'secret SQL detail');
});
