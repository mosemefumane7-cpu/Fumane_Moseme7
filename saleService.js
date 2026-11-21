const { pool } = require('../config/db');
const AppError = require('../middleware/AppError');
const { requireObject, positiveIdValue, nonNegativeMoney, requireEnum } = require('../middleware/validators');
const { normalizeSaleItems, PAYMENT_METHODS } = require('../utils/domainValidation');
const { computeSaleTotals } = require('../utils/saleTotals');
const { toCents, fromCents } = require('../utils/money');
const vendorModel = require('../models/vendorModel');
const salesModel = require('../models/salesModel');
const paymentModel = require('../models/paymentModel');

function normalizeInitialPayment(value, totalCents) {
  if (value === undefined || value === null) return null;
  const payment = requireObject(value, 'payment');
  const amount = nonNegativeMoney(payment.amount, 'Payment amount');
  if (amount <= 0) throw new AppError(400, 'Payment amount must be greater than zero.');
  const method = requireEnum(payment.method, PAYMENT_METHODS, 'Payment method');
  if (toCents(amount) > totalCents) throw new AppError(409, 'The payment exceeds the sale total.');
  const reference = payment.reference === undefined || payment.reference === '' ? null : String(payment.reference).trim();
  if (reference && reference.length > 120) throw new AppError(400, 'Payment reference must be 120 characters or fewer.');
  return { amount, method, reference };
}

function paymentStatus(paidCents, totalCents) {
  if (paidCents >= totalCents) return 'PAID';
  return paidCents > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
}

async function createSale(input) {
  const body = requireObject(input);
  const vendorId = positiveIdValue(body.vendor_id, 'Vendor id');
  const items = normalizeSaleItems(body.items);
  const connection = await pool.getConnection();
  let response;

  try {
    await connection.beginTransaction();
    if (!(await vendorModel.findById(vendorId, connection))) throw new AppError(404, 'Vendor not found.');

    // Lock requested fruit/size rows, then validate every quantity before the first write.
    const stockRows = await salesModel.lockStockRows(connection, items);
    const totals = computeSaleTotals(items, stockRows);
    const initialPayment = normalizeInitialPayment(body.payment, totals.total_cents);
    const requested = new Map();
    for (const item of items) {
      const key = `${item.fruit_id}:${item.packaging_size}`;
      requested.set(key, (requested.get(key) || 0) + item.quantity);
    }
    const rowByKey = new Map(stockRows.map((row) => [`${row.fruit_id}:${row.packaging_size}`, row]));

    for (const [key, quantity] of requested) {
      const row = rowByKey.get(key);
      if (!(await salesModel.decrementStock(connection, row.stock_id, quantity))) {
        throw new AppError(409, 'Stock changed while saving this sale. Please review availability and try again.');
      }
    }

    const saleId = await salesModel.createHeader(connection, vendorId, totals.total_amount);
    for (const line of totals.lines) await salesModel.createDetail(connection, saleId, line);
    if (initialPayment) await paymentModel.create(connection, saleId, initialPayment);

    const paidCents = initialPayment ? toCents(initialPayment.amount) : 0;
    const status = paymentStatus(paidCents, totals.total_cents);
    await salesModel.updatePaymentSummary(connection, saleId, fromCents(paidCents), status);
    await connection.commit();

    response = {
      sale_id: saleId,
      vendor_id: vendorId,
      payment_status: status,
      total_amount: totals.total_amount,
      amount_paid: fromCents(paidCents),
      outstanding_balance: fromCents(totals.total_cents - paidCents),
      items: totals.lines
    };
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* Preserve the original failure. */ }
    throw error;
  } finally {
    connection.release();
  }

  return response;
}

module.exports = { createSale, paymentStatus };
