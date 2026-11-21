const AppError = require('../middleware/AppError');
const { positiveId, requireObject } = require('../middleware/validators');
const { fruitInput } = require('../utils/domainValidation');
const model = require('../models/fruitModel');

async function list(_req, res) {
  res.json({ success: true, data: await model.list() });
}

async function create(req, res) {
  const data = fruitInput(requireObject(req.body));
  res.status(201).json({ success: true, data: await model.create(data) });
}

async function update(req, res) {
  const id = positiveId(req.params.id, 'Fruit id');
  const current = await model.findById(id);
  if (!current) throw new AppError(404, 'Fruit not found.');
  const data = fruitInput(requireObject(req.body), current);
  await model.update(id, data);
  res.json({ success: true, data: await model.findById(id) });
}

module.exports = { list, create, update };
