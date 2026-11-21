const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../middleware/asyncHandler");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const requireCsrf = require("../middleware/csrf");
const requireDatabase = require("../middleware/requireDatabase");
const authController = require("../controllers/authController");

const router = express.Router();
const limiter = (message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });
const loginLimiter = limiter("Too many attempts. Please wait before trying again.");
const registerLimiter = limiter("Too many sign-ups from this device. Please wait before trying again.");

router.get("/status", requireDatabase, asyncHandler(authController.status));
router.post("/register", registerLimiter, requireDatabase, asyncHandler(authController.register));
router.post("/login", loginLimiter, requireDatabase, asyncHandler(authController.login));
router.get("/me", requireAuth, requireDatabase, asyncHandler(authController.me));
router.post("/logout", requireAuth, requireCsrf, authController.logout);

router.get("/users", requireAuth, requireDatabase, requireAdmin, asyncHandler(authController.listUsers));
router.patch(
  "/users/:id/role",
  requireAuth,
  requireCsrf,
  requireDatabase,
  requireAdmin,
  asyncHandler(authController.changeRole),
);

module.exports = router;
