const express = require('express');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../middleware/asyncHandler');
const requireDatabase = require('../middleware/requireDatabase');
const { requireVendor, requireVendorCsrf } = require('../middleware/vendorAuth');
const controller = require('../controllers/portalController');

const router = express.Router();
const limiter = (message) => rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message }
});

router.post('/register', limiter('Too many sign-up attempts. Please wait before trying again.'), requireDatabase, asyncHandler(controller.register));
router.post('/login', limiter('Too many attempts. Please wait before trying again.'), requireDatabase, asyncHandler(controller.login));
router.post('/logout', controller.logout);

router.use(requireDatabase, requireVendor, requireVendorCsrf);
router.get('/me', asyncHandler(controller.me));
router.get('/summary', asyncHandler(controller.summary));
router.get('/sales', asyncHandler(controller.listSales));
router.get('/sales/:id', asyncHandler(controller.getSale));
router.post('/sales/:id/payments', asyncHandler(controller.pay));

module.exports = router;
