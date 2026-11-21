const { markDatabaseUnavailable } = require('../config/db');
const { logger } = require('../utils/logger');

const DB_CONNECTION_ERRORS = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', 'EAI_AGAIN',
  'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT', 'POOL_CLOSED',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR'
]);

module.exports = function errorHandler(error, _req, res, _next) {
  const databaseUnavailable = DB_CONNECTION_ERRORS.has(error.code);
  const invalidRequestBody = error.type === 'entity.parse.failed' || error.type === 'entity.too.large';
  if (databaseUnavailable) markDatabaseUnavailable();

  let statusCode = databaseUnavailable ? 503 : (invalidRequestBody ? 400 : (Number.isInteger(error.statusCode) ? error.statusCode : 500));
  if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') statusCode = 409;
  if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || error.code === 'ER_DATA_TOO_LONG' || error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') statusCode = 400;

  const message = databaseUnavailable
    ? 'The database is temporarily unavailable. Please try again shortly.'
    : (invalidRequestBody
      ? (error.type === 'entity.too.large' ? 'The request body is too large.' : 'The request body must contain valid JSON.')
      : (statusCode >= 500 && !error.isOperational ? 'An unexpected server error occurred.' : error.message));
  if (statusCode >= 500) logger.error(error.message || 'Request failed', error);

  const payload = { success: false, message };
  if (error.details !== undefined) payload.details = error.details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500 && !databaseUnavailable) {
    payload.details = { ...(payload.details || {}), error: error.message };
  }
  res.status(statusCode).json(payload);
};
