const { pool } = require('../config/db');

async function create(executor, saleId, payment) {
  const [result] = await executor.execute(
    'INSERT INTO payments (sale_id, amount, payment_method, reference) VALUES (?, ?, ?, ?)',
    [saleId, payment.amount, payment.method, payment.reference || null]
  );
  return result.insertId;
}

async function sumForSale(executor, saleId) {
  const [rows] = await executor.execute('SELECT COALESCE(SUM(amount), 0.00) AS total_paid FROM payments WHERE sale_id = ?', [saleId]);
  return Number(rows[0].total_paid);
}

async function listForSale(saleId) {
  const [rows] = await pool.execute(
    'SELECT payment_id, sale_id, amount, payment_method, payment_date, reference FROM payments WHERE sale_id = ? ORDER BY payment_date DESC, payment_id DESC',
    [saleId]
  );
  return rows;
}

module.exports = { create, sumForSale, listForSale };
