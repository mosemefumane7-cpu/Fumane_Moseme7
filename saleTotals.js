const AppError = require('../middleware/AppError');
const { fromCents, toCents, lineTotalCents } = require('./money');

function computeSaleTotals(items, lockedStockRows) {
  const stockByKey = new Map(lockedStockRows.map((row) => [`${row.fruit_id}:${row.packaging_size}`, row]));
  const requestedByKey = new Map();
  for (const item of items) {
    const key = `${item.fruit_id}:${item.packaging_size}`;
    requestedByKey.set(key, (requestedByKey.get(key) || 0) + item.quantity);
  }

  for (const [key, requested] of requestedByKey) {
    const row = stockByKey.get(key);
    if (!row) {
      const item = items.find((entry) => `${entry.fruit_id}:${entry.packaging_size}` === key);
      throw new AppError(409, `No ${item.packaging_size} stock row is configured for fruit ${item.fruit_id}.`);
    }
    if (requested > Number(row.available_quantity)) {
      throw new AppError(409, `Requested ${requested} ${row.packaging_size} ${row.fruit_name}, only ${row.available_quantity} available.`);
    }
  }

  let grandTotalCents = 0;
  const lines = items.map((item) => {
    const row = stockByKey.get(`${item.fruit_id}:${item.packaging_size}`);
    const unitPrice = fromCents(toCents(row.selling_price));
    const totalCents = lineTotalCents(item.quantity, unitPrice);
    grandTotalCents += totalCents;
    return { ...item, unit_price: unitPrice, line_total: fromCents(totalCents), stock_id: row.stock_id };
  });
  return { lines, total_amount: fromCents(grandTotalCents), total_cents: grandTotalCents };
}

module.exports = { computeSaleTotals };
