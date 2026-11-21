const AppError = require('../middleware/AppError');
const { positiveId } = require('../middleware/validators');
const purchaseModel = require('../models/purchaseModel');
const purchaseService = require('../services/purchaseService');

async function list(_req, res) {
  res.json({ success: true, data: await purchaseModel.list() });
}

async function get(req, res) {
  const row = await purchaseModel.findById(positiveId(req.params.id, 'Purchase id'));
  if (!row) throw new AppError(404, 'Purchase not found.');
  res.json({ success: true, data: row });
}

async function create(req, res) {
  res.status(201).json({ success: true, data: await purchaseService.createPurchase(req.body) });
}

module.exports = { list, get, create };
