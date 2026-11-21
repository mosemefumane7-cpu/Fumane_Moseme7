const { pool } = require('../config/db');

async function validateFruits(executor, fruitIds) {
  const ids = [...new Set(fruitIds)];
  const [rows] = await executor.execute(`SELECT fruit_id FROM fruits WHERE fruit_id IN (${ids.map(() => '?').join(',')})`, ids);
  return new Set(rows.map((row) => Number(row.fruit_id)));
}

async function createHeader(executor, supplierId, totalAmount, purchaseDate = null) {
  const sql = purchaseDate
    ? 'INSERT INTO purchases (supplier_id, total_amount, purchase_date) VALUES (?, ?, ?)'
    : 'INSERT INTO purchases (supplier_id, total_amount) VALUES (?, ?)';
  const values = purchaseDate ? [supplierId, totalAmount, purchaseDate] : [supplierId, totalAmount];
  const [result] = await executor.execute(sql, values);
  return result.insertId;
}

async function createDetail(executor, purchaseId, item) {
  await executor.execute(
    'INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES (?, ?, ?, ?, ?)',
    [purchaseId, item.fruit_id, item.quantity, item.unit_cost, item.packaging_size]
  );
}

async function upsertStock(executor, entries) {
  for (const item of entries) {
    // Preserve a manually maintained retail price on duplicate; new stock gets a documented size-aware estimate.
    await executor.execute(
      `INSERT INTO stock (fruit_id, packaging_size, available_quantity, selling_price)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE available_quantity = available_quantity + VALUES(available_quantity)`,
      [item.fruit_id, item.packaging_size, item.quantity, item.initial_selling_price]
    );
  }
}

async function list() {
  const [rows] = await pool.execute(
    `SELECT p.purchase_id, p.supplier_id, su.business_name AS supplier_name, p.purchase_date, p.total_amount,
            COUNT(pd.purchase_detail_id) AS item_count
     FROM purchases AS p
     JOIN suppliers AS su ON su.supplier_id = p.supplier_id
     LEFT JOIN purchase_details AS pd ON pd.purchase_id = p.purchase_id
     GROUP BY p.purchase_id, p.supplier_id, su.business_name, p.purchase_date, p.total_amount
     ORDER BY p.purchase_date DESC, p.purchase_id DESC`
  );
  return rows;
}

async function findById(id) {
  const [headers] = await pool.execute(
    `SELECT p.purchase_id, p.supplier_id, su.business_name AS supplier_name, p.purchase_date, p.total_amount
     FROM purchases AS p JOIN suppliers AS su ON su.supplier_id = p.supplier_id
     WHERE p.purchase_id = ?`, [id]
  );
  if (!headers[0]) return null;
  const [items] = await pool.execute(
    `SELECT pd.purchase_detail_id, pd.fruit_id, f.fruit_name, pd.packaging_size, pd.quantity, pd.unit_cost
     FROM purchase_details AS pd JOIN fruits AS f ON f.fruit_id = pd.fruit_id
     WHERE pd.purchase_id = ? ORDER BY pd.purchase_detail_id`, [id]
  );
  return { ...headers[0], items };
}

module.exports = { validateFruits, createHeader, createDetail, upsertStock, list, findById };
