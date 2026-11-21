const AppError = require('../middleware/AppError');
const { positiveId, requireObject, requireNonEmptyString } = require('../middleware/validators');
const { vendorInput } = require('../utils/domainValidation');
const model = require('../models/vendorModel');

async function list(_req, res) {
  res.json({ success: true, data: await model.list() });
}

async function search(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) return res.json({ success: true, data: [] });
  res.json({ success: true, data: await model.search(query.slice(0, 100)) });
}

async function outstanding(_req, res) {
  res.json({ success: true, data: await model.listOutstanding() });
}

async function get(req, res) {
  const row = await model.findById(positiveId(req.params.id, 'Vendor id'));
  if (!row) throw new AppError(404, 'Vendor not found.');
  res.json({ success: true, data: row });
}

async function create(req, res) {
  const data = vendorInput(requireObject(req.body));
  res.status(201).json({ success: true, data: await model.create(data) });
}

async function update(req, res) {
  const id = positiveId(req.params.id, 'Vendor id');
  const current = await model.findById(id);
  if (!current) throw new AppError(404, 'Vendor not found.');
  const data = vendorInput(requireObject(req.body), current);
  await model.update(id, data);
  res.json({ success: true, data: await model.findById(id) });
}

async function balance(req, res) {
  const id = positiveId(req.params.id, 'Vendor id');
  const row = await model.getBalance(id);
  if (!row) throw new AppError(404, 'Vendor not found.');
  res.json({ success: true, data: row });
}

module.exports = { list, search, outstanding, get, create, update, balance };
