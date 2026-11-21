const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/vendorController');
const router = express.Router();

router.get('/search', asyncHandler(controller.search));
router.get('/outstanding', asyncHandler(controller.outstanding));
router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/:id/balance', asyncHandler(controller.balance));
router.get('/:id', asyncHandler(controller.get));
router.put('/:id', asyncHandler(controller.update));

module.exports = router;
