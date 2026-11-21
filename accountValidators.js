const AppError = require("./AppError");

function normalizeUsername(value) {
  if (typeof value !== "string" || !value.trim())
    throw new AppError(400, "Username is required.");
  const clean = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(clean))
    throw new AppError(
      400,
      "Username must be 3 to 40 characters: letters, numbers, dot, dash or underscore.",
    );
  return clean;
}

function validateNewPassword(value) {
  if (typeof value !== "string" || value.length < 8)
    throw new AppError(400, "Password must be at least 8 characters.");
  if (value.length > 72)
    throw new AppError(400, "Password must be 72 characters or fewer.");
  return value;
}

function cleanFullName(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string")
    throw new AppError(400, "Full name must be text.");
  const clean = value.trim();
  if (clean.length > 120)
    throw new AppError(400, "Full name must be 120 characters or fewer.");
  return clean || null;
}

module.exports = { normalizeUsername, validateNewPassword, cleanFullName };
