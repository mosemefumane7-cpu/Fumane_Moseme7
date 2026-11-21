const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/salesController');
const router = express.Router();

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.get));

module.exports = router;
