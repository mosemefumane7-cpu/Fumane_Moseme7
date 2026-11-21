const AppError = require('../middleware/AppError');
const { positiveId, requireObject } = require('../middleware/validators');
const { supplierInput } = require('../utils/domainValidation');
const model = require('../models/supplierModel');

async function list(_req, res) {
  res.json({ success: true, data: await model.list() });
}

async function get(req, res) {
  const row = await model.findById(positiveId(req.params.id, 'Supplier id'));
  if (!row) throw new AppError(404, 'Supplier not found.');
  res.json({ success: true, data: row });
}

async function create(req, res) {
  const data = supplierInput(requireObject(req.body));
  res.status(201).json({ success: true, data: await model.create(data) });
}

async function update(req, res) {
  const id = positiveId(req.params.id, 'Supplier id');
  const current = await model.findById(id);
  if (!current) throw new AppError(404, 'Supplier not found.');
  const data = supplierInput(requireObject(req.body), current);
  await model.update(id, data);
  res.json({ success: true, data: await model.findById(id) });
}

async function remove(req, res) {
  const id = positiveId(req.params.id, 'Supplier id');
  if (!(await model.findById(id))) throw new AppError(404, 'Supplier not found.');
  if (await model.hasPurchases(id)) throw new AppError(409, 'This supplier has purchase records and cannot be deleted.');
  await model.remove(id);
  res.json({ success: true, message: 'Supplier deleted.' });
}

module.exports = { list, get, create, update, remove };
