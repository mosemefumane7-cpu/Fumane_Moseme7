const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/fruitController');
const router = express.Router();

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.put('/:id', asyncHandler(controller.update));

module.exports = router;
