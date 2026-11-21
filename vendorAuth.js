// Authentication for the vendor portal. Vendor sessions are completely separate from
// administrator/staff sessions: a different cookie, a different JWT audience and a
// `vid` claim instead of `uid`, so a vendor token can never pass the admin middleware
// and an admin token can never pass this one.
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const AppError = require('./AppError');
const vendorAccountModel = require('../models/vendorAccountModel');

const VENDOR_COOKIE_NAME = 'batloung_vendor_session';
const AUDIENCE = 'batloung-vendor';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(503, 'Sign-in is not configured. Set a JWT_SECRET of at least 32 characters.');
  }
  return secret;
}

function vendorCookieOptions() {
  const secure = process.env.COOKIE_SECURE !== 'false';
  return { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 };
}

function clearVendorCookieOptions() {
  const options = vendorCookieOptions();
  delete options.maxAge;
  return options;
}

function createVendorToken(vendorId, csrfToken) {
  return jwt.sign({ typ: 'vendor', vid: vendorId, csrfToken }, getJwtSecret(), {
    subject: `vendor:${vendorId}`,
    audience: AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    algorithm: 'HS256'
  });
}

function newCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function requireVendor(req, _res, next) {
  try {
    const token = req.cookies?.[VENDOR_COOKIE_NAME];
    if (!token) throw new AppError(401, 'Please sign in to the vendor portal.');
    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'], audience: AUDIENCE });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Your session is invalid or has expired. Please sign in again.');
    }
    if (payload.typ !== 'vendor' || !Number.isInteger(payload.vid) || typeof payload.csrfToken !== 'string') {
      throw new AppError(401, 'Your session needs to be refreshed. Please sign in again.');
    }
    // The account must still exist (for example, it disappears if the vendor is deleted).
    if (!(await vendorAccountModel.findAccountByVendorId(payload.vid))) {
      throw new AppError(401, 'This account no longer exists. Please sign in again.');
    }
    req.vendor = { vendor_id: payload.vid, csrfToken: payload.csrfToken };
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireVendorCsrf(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const expected = req.vendor?.csrfToken;
  const provided = req.get('x-csrf-token');
  if (typeof expected !== 'string' || typeof provided !== 'string') {
    return next(new AppError(403, 'Your request security token is missing. Refresh the page and try again.'));
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new AppError(403, 'Your request security token is invalid. Refresh the page and try again.'));
  }
  return next();
}

module.exports = {
  VENDOR_COOKIE_NAME, vendorCookieOptions, clearVendorCookieOptions,
  createVendorToken, newCsrfToken, requireVendor, requireVendorCsrf
};
