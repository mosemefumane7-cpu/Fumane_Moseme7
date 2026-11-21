const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const controller = require('../controllers/stockController');
const router = express.Router();

router.get('/', asyncHandler(controller.list));
router.get('/low', asyncHandler(controller.low));
router.get('/fruit/:fruitId', asyncHandler(controller.byFruit));
router.put('/:id', asyncHandler(controller.update));

module.exports = router;
