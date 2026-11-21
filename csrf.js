const crypto = require("node:crypto");
const AppError = require("./AppError");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

module.exports = function requireCsrf(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const expected = req.admin?.csrfToken;
  const provided = req.get("x-csrf-token");
  if (typeof expected !== "string" || typeof provided !== "string") {
    return next(
      new AppError(
        403,
        "Your request security token is missing. Refresh the page and try again.",
      ),
    );
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return next(
      new AppError(
        403,
        "Your request security token is invalid. Refresh the page and try again.",
      ),
    );
  }

  return next();
};
