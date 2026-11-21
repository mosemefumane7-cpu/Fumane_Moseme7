const AppError = require('../middleware/AppError');
const { positiveId, requireObject, nonNegativeMoney, positiveInteger } = require('../middleware/validators');
const stockModel = require('../models/stockModel');
const fruitModel = require('../models/fruitModel');

async function list(_req, res) {
  res.json({ success: true, data: await stockModel.list() });
}

async function byFruit(req, res) {
  const fruitId = positiveId(req.params.fruitId, 'Fruit id');
  if (!(await fruitModel.findById(fruitId))) throw new AppError(404, 'Fruit not found.');
  res.json({ success: true, data: await stockModel.listByFruit(fruitId) });
}

async function low(_req, res) {
  res.json({ success: true, data: await stockModel.listLow() });
}

async function update(req, res) {
  const id = positiveId(req.params.id, 'Stock id');
  const current = await stockModel.findById(id);
  if (!current) throw new AppError(404, 'Stock row not found.');
  const body = requireObject(req.body);
  if (body.selling_price === undefined && body.low_stock_threshold === undefined) {
    throw new AppError(400, 'Provide selling_price, low_stock_threshold, or both.');
  }
  const price = body.selling_price === undefined ? current.selling_price : nonNegativeMoney(body.selling_price, 'Selling price');
  const threshold = body.low_stock_threshold === undefined
    ? current.low_stock_threshold
    : (body.low_stock_threshold === 0 ? 0 : positiveInteger(body.low_stock_threshold, 'Low-stock threshold'));
  await stockModel.update(id, price, threshold);
  res.json({ success: true, data: await stockModel.findById(id) });
}

module.exports = { list, byFruit, low, update };
