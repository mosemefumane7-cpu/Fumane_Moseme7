const AppError = require('./AppError');
const { getDatabaseStatus } = require('../config/db');

module.exports = function requireDatabase(_req, _res, next) {
  if (!getDatabaseStatus().connected) {
    return next(new AppError(503, 'The database is temporarily unavailable. Please try again shortly.'));
  }
  return next();
};
