const { pool } = require('../config/db');
const AppError = require('../middleware/AppError');
const { requireObject, positiveId, nonNegativeMoney, requireEnum, requireNonEmptyString } = require('../middleware/validators');
const { PAYMENT_METHODS } = require('../utils/domainValidation');
const { toCents, fromCents } = require('../utils/money');
const salesModel = require('../models/salesModel');
const paymentModel = require('../models/paymentModel');
const { paymentStatus } = require('./saleService');

function parsePayment(input) {
  const body = requireObject(input);
  const amount = nonNegativeMoney(body.amount, 'Payment amount');
  if (amount <= 0) throw new AppError(400, 'Payment amount must be greater than zero.');
  const method = requireEnum(body.method ?? body.payment_method, PAYMENT_METHODS, 'Payment method');
  const reference = body.reference === undefined || body.reference === '' ? null : requireNonEmptyString(body.reference, 'Payment reference', 120);
  return { amount, method, reference };
}

async function recordPayment(saleIdValue, input) {
  const saleId = positiveId(saleIdValue, 'Sale id');
  const payment = parsePayment(input);
  const connection = await pool.getConnection();
  let paymentId;
  let updated;

  try {
    await connection.beginTransaction();
    const sale = await salesModel.lockSale(connection, saleId);
    if (!sale) throw new AppError(404, 'Sale not found.');
    const totalCents = toCents(sale.total_amount);
    const paidBeforeCents = toCents(await paymentModel.sumForSale(connection, saleId));
    const paymentCents = toCents(payment.amount);
    const remainingCents = totalCents - paidBeforeCents;
    if (paymentCents > remainingCents) throw new AppError(409, `Payment exceeds the outstanding balance of ${fromCents(Math.max(0, remainingCents)).toFixed(2)}.`);

    paymentId = await paymentModel.create(connection, saleId, payment);
    const paidAfterCents = paidBeforeCents + paymentCents;
    const status = paymentStatus(paidAfterCents, totalCents);
    await salesModel.updatePaymentSummary(connection, saleId, fromCents(paidAfterCents), status);
    updated = { payment_id: paymentId, sale_id: saleId, amount: payment.amount, method: payment.method, payment_status: status, amount_paid: fromCents(paidAfterCents), outstanding_balance: fromCents(totalCents - paidAfterCents) };
    await connection.commit();
  } catch (error) {
    try { await connection.rollback(); } catch (_) { /* Preserve the original failure. */ }
    throw error;
  } finally {
    connection.release();
  }
  return updated;
}

module.exports = { recordPayment, parsePayment };
