const test = require("node:test");
const assert = require("node:assert/strict");
const requireCsrf = require("../middleware/csrf");
const AppError = require("../middleware/AppError");
const { cookieOptions, clearCookieOptions } = require("../middleware/auth");

function run(method, csrfToken, providedToken) {
  let error;
  let advanced = false;
  const req = {
    method,
    admin: csrfToken ? { csrfToken } : undefined,
    get(name) {
      return name.toLowerCase() === "x-csrf-token" ? providedToken : undefined;
    },
  };
  requireCsrf(req, {}, (value) => {
    error = value;
    if (!value) advanced = true;
  });
  return { error, advanced };
}

test("safe methods do not require a CSRF token", () => {
  assert.deepEqual(run("GET"), { error: undefined, advanced: true });
});

test("state-changing requests without a CSRF token fail with 403", () => {
  const result = run("POST");
  assert.equal(result.advanced, false);
  assert.ok(result.error instanceof AppError);
  assert.equal(result.error.statusCode, 403);
});

test("state-changing requests accept the exact token bound to the session", () => {
  assert.deepEqual(
    run("POST", "random-session-token", "random-session-token"),
    {
      error: undefined,
      advanced: true,
    },
  );
});

test("state-changing requests reject a mismatched token", () => {
  const result = run("DELETE", "expected-session-token", "attacker-token");
  assert.equal(result.advanced, false);
  assert.equal(result.error.statusCode, 403);
});

test("secure cookies default to Preview-compatible SameSite=None; Secure", () => {
  const original = process.env.COOKIE_SECURE;
  try {
    delete process.env.COOKIE_SECURE;
    assert.deepEqual(cookieOptions(), {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    });
    process.env.COOKIE_SECURE = "false";
    const local = cookieOptions();
    assert.equal(local.secure, false);
    assert.equal(local.sameSite, "lax");
  } finally {
    if (original === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = original;
  }
});

test("logout clearing keeps the secure cookie flags and omits deprecated maxAge", () => {
  const original = process.env.COOKIE_SECURE;
  try {
    delete process.env.COOKIE_SECURE;
    const options = clearCookieOptions();
    assert.deepEqual(options, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    assert.equal(Object.hasOwn(options, "maxAge"), false);
  } finally {
    if (original === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = original;
  }
});
