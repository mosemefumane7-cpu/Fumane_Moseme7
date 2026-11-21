const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeUsername,
  validateNewPassword,
  cleanFullName,
} = require("../middleware/accountValidators");
const userModel = require("../models/userModel");
const { requireWriteAccess, requireAdmin } = require("../middleware/auth");

function run(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error));
  });
}

test("usernames are trimmed and lower-cased; bad ones are rejected", () => {
  assert.equal(normalizeUsername("  Sisco_1 "), "sisco_1");
  assert.throws(() => normalizeUsername("ab"), { statusCode: 400 });
  assert.throws(() => normalizeUsername("has space"), { statusCode: 400 });
});

test("passwords need 8 to 72 characters", () => {
  assert.throws(() => validateNewPassword("short"), { statusCode: 400 });
  assert.throws(() => validateNewPassword("x".repeat(73)), { statusCode: 400 });
  assert.equal(validateNewPassword("longenough1"), "longenough1");
});

test("full name is optional", () => {
  assert.equal(cleanFullName(undefined), null);
  assert.equal(cleanFullName("  Ruth "), "Ruth");
});

test("staff can read but not change data", async () => {
  const original = userModel.findById;
  userModel.findById = async () => ({ user_id: 2, role: "staff" });
  try {
    assert.equal(await run(requireWriteAccess, { method: "GET", admin: { uid: 2 } }), undefined);
    const error = await run(requireWriteAccess, { method: "POST", admin: { uid: 2 } });
    assert.equal(error.statusCode, 403);
  } finally {
    userModel.findById = original;
  }
});

test("admins can change data and a deleted account is signed out", async () => {
  const original = userModel.findById;
  try {
    userModel.findById = async () => ({ user_id: 1, role: "admin" });
    assert.equal(await run(requireWriteAccess, { method: "POST", admin: { uid: 1 } }), undefined);
    assert.equal(await run(requireAdmin, { admin: { uid: 1 } }), undefined);
    userModel.findById = async () => null;
    const gone = await run(requireWriteAccess, { method: "DELETE", admin: { uid: 1 } });
    assert.equal(gone.statusCode, 401);
  } finally {
    userModel.findById = original;
  }
});

test("only admins pass requireAdmin", async () => {
  const original = userModel.findById;
  userModel.findById = async () => ({ user_id: 3, role: "staff" });
  try {
    const error = await run(requireAdmin, { admin: { uid: 3 } });
    assert.equal(error.statusCode, 403);
  } finally {
    userModel.findById = original;
  }
});
