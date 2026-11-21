const { pool } = require('../config/db');

async function vendorExists(executor, vendorId) {
  const [rows] = await executor.execute('SELECT vendor_id FROM vendors WHERE vendor_id = ?', [vendorId]);
  return rows.length > 0;
}

async function lockStockRows(executor, items) {
  const unique = new Map(items.map((item) => [`${item.fruit_id}:${item.packaging_size}`, item]));
  const pairs = [...unique.values()];
  const predicate = pairs.map(() => '(st.fruit_id = ? AND st.packaging_size = ?)').join(' OR ');
  const values = pairs.flatMap((item) => [item.fruit_id, item.packaging_size]);
  const [rows] = await executor.execute(
    `SELECT st.stock_id, st.fruit_id, f.fruit_name, st.packaging_size,
            st.available_quantity, st.selling_price
     FROM stock AS st JOIN fruits AS f ON f.fruit_id = st.fruit_id
     WHERE ${predicate}
     ORDER BY st.fruit_id, st.packaging_size
     FOR UPDATE`,
    values
  );
  return rows;
}

async function createHeader(executor, vendorId, totalAmount) {
  const [result] = await executor.execute(
    'INSERT INTO sales (vendor_id, payment_status, total_amount, amount_paid) VALUES (?, \'UNPAID\', ?, 0.00)',
    [vendorId, totalAmount]
  );
  return result.insertId;
}

async function createDetail(executor, saleId, item) {
  await executor.execute(
    'INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
    [saleId, item.fruit_id, item.packaging_size, item.quantity, item.unit_price]
  );
}

async function decrementStock(executor, stockId, quantity) {
  const [result] = await executor.execute(
    'UPDATE stock SET available_quantity = available_quantity - ? WHERE stock_id = ? AND available_quantity >= ?',
    [quantity, stockId, quantity]
  );
  return result.affectedRows === 1;
}

async function lockSale(executor, saleId) {
  const [rows] = await executor.execute(
    'SELECT sale_id, vendor_id, total_amount, amount_paid FROM sales WHERE sale_id = ? FOR UPDATE',
    [saleId]
  );
  return rows[0] || null;
}

async function updatePaymentSummary(executor, saleId, amountPaid, status) {
  await executor.execute('UPDATE sales SET amount_paid = ?, payment_status = ? WHERE sale_id = ?', [amountPaid, status, saleId]);
}

async function list() {
  const [rows] = await pool.execute(
    `SELECT s.sale_id, s.vendor_id, v.vendor_name, s.sale_date, s.payment_status,
            s.total_amount, s.amount_paid, GREATEST(s.total_amount - s.amount_paid, 0.00) AS outstanding_balance
     FROM sales AS s JOIN vendors AS v ON v.vendor_id = s.vendor_id
     ORDER BY s.sale_date DESC, s.sale_id DESC`
  );
  return rows;
}

async function findById(id) {
  const [headers] = await pool.execute(
    `SELECT s.sale_id, s.vendor_id, v.vendor_name, s.sale_date, s.payment_status,
            s.total_amount, s.amount_paid, GREATEST(s.total_amount - s.amount_paid, 0.00) AS outstanding_balance
     FROM sales AS s JOIN vendors AS v ON v.vendor_id = s.vendor_id WHERE s.sale_id = ?`, [id]
  );
  if (!headers[0]) return null;
  const [items] = await pool.execute(
    `SELECT sd.sales_detail_id, sd.fruit_id, f.fruit_name, sd.packaging_size,
            sd.quantity, sd.unit_price, ROUND(sd.quantity * sd.unit_price, 2) AS line_total
     FROM sales_details AS sd JOIN fruits AS f ON f.fruit_id = sd.fruit_id
     WHERE sd.sale_id = ? ORDER BY sd.sales_detail_id`, [id]
  );
  return { ...headers[0], items };
}

module.exports = { vendorExists, lockStockRows, createHeader, createDetail, decrementStock, lockSale, updatePaymentSummary, list, findById };
