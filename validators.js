const AppError = require('./AppError');

function positiveId(value, label = 'id') {
  if (typeof value !== 'number' && typeof value !== 'string') throw new AppError(400, `${label} must be a positive integer.`);
  if (typeof value === 'string' && !/^\d+$/.test(value)) throw new AppError(400, `${label} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AppError(400, `${label} must be a positive integer.`);
  return parsed;
}

function positiveIdValue(value, label = 'id') {
  if (typeof value !== 'number') throw new AppError(400, `${label} must be a number.`);
  return positiveId(value, label);
}

function requireObject(value, label = 'Request body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, `${label} must be a JSON object.`);
  return value;
}

function requireNonEmptyString(value, label, maxLength = 255) {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(400, `${label} is required.`);
  const clean = value.trim();
  if (clean.length > maxLength) throw new AppError(400, `${label} must be ${maxLength} characters or fewer.`);
  return clean;
}

function requireEnum(value, values, label) {
  if (!values.includes(value)) throw new AppError(400, `${label} must be one of: ${values.join(', ')}.`);
  return value;
}

function positiveInteger(value, label) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > 4294967295) {
    throw new AppError(400, `${label} must be a positive whole number within the supported range.`);
  }
  return value;
}

function nonNegativeMoney(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Math.round(value * 100) !== value * 100) {
    throw new AppError(400, `${label} must be a non-negative number with at most two decimal places.`);
  }
  return Math.round(value * 100) / 100;
}

module.exports = { positiveId, positiveIdValue, requireObject, requireNonEmptyString, requireEnum, positiveInteger, nonNegativeMoney };
