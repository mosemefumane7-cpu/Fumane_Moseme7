const jwt = require("jsonwebtoken");
const AppError = require("./AppError");
const userModel = require("../models/userModel");

const COOKIE_NAME = "batloung_session";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(
      503,
      "Sign-in is not configured. Set a JWT_SECRET of at least 32 characters.",
    );
  return secret;
}

function cookieOptions() {
  const secure = process.env.COOKIE_SECURE !== "false";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
}

function clearCookieOptions() {
  const options = cookieOptions();
  delete options.maxAge;
  return options;
}

function requireAuth(req, _res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const token =
      req.cookies?.[COOKIE_NAME] ||
      (authorization.startsWith("Bearer ") ? authorization.slice(7) : null);
    if (!token) throw new AppError(401, "Please sign in to continue.");
    const admin = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof admin.csrfToken !== "string" || typeof admin.uid !== "number") {
      throw new AppError(
        401,
        "Your session needs to be refreshed. Please sign in again.",
      );
    }
    req.admin = admin;
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(
      new AppError(
        401,
        "Your session is invalid or has expired. Please sign in again.",
      ),
    );
  }
}

function createSessionToken(user, csrfToken) {
  return jwt.sign(
    { role: user.role, uid: user.user_id, csrfToken },
    getJwtSecret(),
    {
      subject: user.username,
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      algorithm: "HS256",
    },
  );
}

// Staff accounts are read-only. The role is re-read from the database on every
// change request, so a demotion takes effect immediately.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
async function requireWriteAccess(req, _res, next) {
  try {
    if (SAFE_METHODS.has(req.method)) return next();
    const user = await userModel.findById(req.admin.uid);
    if (!user)
      throw new AppError(401, "This account no longer exists. Please sign in again.");
    req.admin.role = user.role;
    if (user.role !== "admin")
      throw new AppError(
        403,
        "Your account is read-only. Ask an administrator for edit access.",
      );
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireAdmin(req, _res, next) {
  try {
    const user = await userModel.findById(req.admin.uid);
    if (!user)
      throw new AppError(401, "This account no longer exists. Please sign in again.");
    if (user.role !== "admin")
      throw new AppError(403, "Only an administrator can do that.");
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  COOKIE_NAME,
  cookieOptions,
  clearCookieOptions,
  requireAuth,
  createSessionToken,
  requireWriteAccess,
  requireAdmin,
};
