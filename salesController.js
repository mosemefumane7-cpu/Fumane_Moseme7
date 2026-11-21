const AppError = require('../middleware/AppError');
const { positiveId } = require('../middleware/validators');
const salesModel = require('../models/salesModel');
const saleService = require('../services/saleService');

async function list(_req, res) {
  res.json({ success: true, data: await salesModel.list() });
}

async function get(req, res) {
  const row = await salesModel.findById(positiveId(req.params.id, 'Sale id'));
  if (!row) throw new AppError(404, 'Sale not found.');
  res.json({ success: true, data: row });
}

async function create(req, res) {
  res.status(201).json({ success: true, data: await saleService.createSale(req.body) });
}

module.exports = { list, get, create };
