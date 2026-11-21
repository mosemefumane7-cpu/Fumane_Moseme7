const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/paymentController');
const router = express.Router();

router.post('/:saleId/payments', asyncHandler(controller.createForSale));
router.get('/:saleId/payments', asyncHandler(controller.listForSale));

module.exports = router;
