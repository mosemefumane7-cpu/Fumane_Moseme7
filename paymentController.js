const AppError = require('../middleware/AppError');
const { positiveId } = require('../middleware/validators');
const salesModel = require('../models/salesModel');
const paymentModel = require('../models/paymentModel');
const paymentService = require('../services/paymentService');

async function listForSale(req, res) {
  const saleId = positiveId(req.params.saleId, 'Sale id');
  if (!(await salesModel.findById(saleId))) throw new AppError(404, 'Sale not found.');
  res.json({ success: true, data: await paymentModel.listForSale(saleId) });
}

async function createForSale(req, res) {
  res.status(201).json({ success: true, data: await paymentService.recordPayment(req.params.saleId, req.body) });
}

module.exports = { listForSale, createForSale };
