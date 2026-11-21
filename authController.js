const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const AppError = require("../middleware/AppError");
const { requireObject, requireEnum, positiveId } = require("../middleware/validators");
const {
  normalizeUsername,
  validateNewPassword,
  cleanFullName,
} = require("../middleware/accountValidators");
const {
  COOKIE_NAME,
  cookieOptions,
  clearCookieOptions,
  createSessionToken,
} = require("../middleware/auth");
const userModel = require("../models/userModel");

// Used so that an unknown username takes as long to reject as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

function startSession(res, user) {
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  res.cookie(COOKIE_NAME, createSessionToken(user, csrfToken), cookieOptions());
  return {
    username: user.username,
    fullName: user.full_name || null,
    role: user.role,
    csrfToken,
  };
}

async function status(_req, res) {
  res.json({ success: true, data: { hasUsers: (await userModel.countUsers()) > 0 } });
}

async function register(req, res) {
  const body = requireObject(req.body);
  const username = normalizeUsername(body.username);
  const password = validateNewPassword(body.password);
  const fullName = cleanFullName(body.fullName);
  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await userModel.createUser({ username, fullName, passwordHash });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      throw new AppError(409, "That username is already taken.");
    if (error.code === "ER_LOCK_DEADLOCK")
      throw new AppError(503, "Please try registering again.");
    throw error;
  }
  res.status(201).json({ success: true, data: startSession(res, user) });
}

async function login(req, res) {
  const body = requireObject(req.body);
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password)
    throw new AppError(400, "Username and password are required.");
  const user = await userModel.findByUsername(username);
  const matches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !matches)
    throw new AppError(401, "The username or password is incorrect.");
  res.json({ success: true, data: startSession(res, user) });
}

async function me(req, res) {
  const user = await userModel.findById(req.admin.uid);
  if (!user) throw new AppError(401, "This account no longer exists. Please sign in again.");
  res.json({
    success: true,
    data: {
      username: user.username,
      fullName: user.full_name || null,
      role: user.role,
      csrfToken: req.admin.csrfToken,
    },
  });
}

function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, clearCookieOptions());
  res.json({ success: true, message: "You have been signed out." });
}

async function listUsers(_req, res) {
  res.json({ success: true, data: await userModel.listUsers() });
}

async function changeRole(req, res) {
  const userId = positiveId(req.params.id, "User id");
  const body = requireObject(req.body);
  const role = requireEnum(body.role, ["admin", "staff"], "Role");
  const result = await userModel.setRole(userId, role);
  if (result === "not_found") throw new AppError(404, "User not found.");
  if (result === "last_admin")
    throw new AppError(409, "There must always be at least one administrator.");
  res.json({ success: true, data: result });
}

module.exports = { status, register, login, me, logout, listUsers, changeRole };
