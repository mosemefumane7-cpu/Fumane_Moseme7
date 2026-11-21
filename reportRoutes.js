const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/reportController');
const router = express.Router();

router.get('/top-fruits', asyncHandler(controller.topFruits));
router.get('/revenue', asyncHandler(controller.revenue));
router.get('/revenue-trend', asyncHandler(controller.revenueTrend));
router.get('/top-vendor', asyncHandler(controller.topVendor));
router.get('/stock-levels', asyncHandler(controller.stockLevels));

module.exports = router;
