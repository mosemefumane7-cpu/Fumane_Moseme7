const { pool } = require('../config/db');
const AppError = require('../middleware/AppError');
const { requireObject, positiveIdValue, nonNegativeMoney } = require('../middleware/validators');
const { normalizePurchaseItems } = require('../utils/domainValidation');
const { toCents, fromCents } = require('../utils/money');
const supplierModel = require('../models/supplierModel');
const purchaseModel = require('../models/purchaseModel');

const SIZE_MARKUP = { SMALL: 1.25, MEDIUM: 1.40, LARGE: 1.55 };

function initialRetailPrice(weightedUnitCostCents, packagingSize) {
  return fromCents(Math.max(1, Math.round(weightedUnitCostCents * SIZE_MARKUP[packagingSize])));
}

function groupStockEntries(items) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.fruit_id}:${item.packaging_size}`;
    const current = groups.get(key) || { fruit_id: item.fruit_id, packaging_size: item.packaging_size, quantity: 0, totalCostCents: 0 };
    current.quantity += item.quantity;
    current.totalCostCents += item.quantity * toCents(item.unit_cost);
    groups.set(key, current);
  }
  return [...groups.values()].map((entry) => ({
    fruit_id: entry.fruit_id,
    packaging_size: entry.packaging_size,
    quantity: entry.quantity,
    initial_selling_price: initialRetailPrice(Math.round(entry.totalCostCents / entry.quantity), entry.packaging_size)
  }));
}

async function createPurchase(input) {
  const body = requireObject(input);
  const supplierId = positiveIdValue(body.supplier_id, 'Supplier id');
  const items = normalizePurchaseItems(body.items);
  if (body.purchase_date !== undefined && (typeof body.purchase_date !== 'string' || Number.isNaN(Date.parse(body.purchase_date)))) {
    throw new AppError(400, 'purchase_date must be a valid date/time string.');
  }
  const totalCents = items.reduce((sum, item) => sum + item.quantity * toCents(item.unit_cost), 0);
  const totalAmount = fromCents(totalCents);
  const connection = await pool.getConnection();
  let purchaseId;

  try {
    await connection.beginTransaction();
    if (!(await supplierModel.findById(supplierId, connection))) throw new AppError(404, 'Supplier not found.');
    const existingFruits = await purchaseModel.validateFruits(connection, items.map((item) => item.fruit_id));
    for (const item of items) {
      if (!existingFruits.has(item.fruit_id)) throw new AppError(404, `Fruit ${item.fruit_id} was not found.`);
    }

    purchaseId = await purchaseModel.createHeader(connection, supplierId, nonNegativeMoney(totalAmount, 'Purchase total'), body.purchase_date || null);
    for (const item of items) await purchaseModel.createDetail(connection, purchaseId, item);
    await purchaseModel.upsertStock(connection, groupStockEntries(items));
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* Preserve the original failure. */ }
    throw error;
  } finally {
    connection.release();
  }

  return { purchase_id: purchaseId, supplier_id: supplierId, total_amount: totalAmount, items };
}

module.exports = { createPurchase };
