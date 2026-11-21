const AppError = require('../middleware/AppError');
const model = require('../models/reportModel');

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, `${label} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(400, `${label} is not a valid calendar date.`);
  }
  return value;
}

function dateRange(req) {
  const from = validDate(req.query.from, 'from');
  const to = validDate(req.query.to, 'to');
  if (from > to) throw new AppError(400, 'from must be on or before to.');
  return { from, to };
}

async function topFruits(_req, res) {
  res.json({ success: true, data: await model.topFruits() });
}

async function revenue(req, res) {
  const { from, to } = dateRange(req);
  res.json({ success: true, data: { from, to, ...(await model.revenue(from, to)) } });
}

async function revenueTrend(req, res) {
  const { from, to } = dateRange(req);
  res.json({ success: true, data: { from, to, points: await model.revenueTrend(from, to) } });
}

async function topVendor(_req, res) {
  res.json({ success: true, data: await model.topVendor() });
}

async function stockLevels(_req, res) {
  res.json({ success: true, data: await model.stockLevels() });
}

module.exports = { topFruits, revenue, revenueTrend, topVendor, stockLevels };
