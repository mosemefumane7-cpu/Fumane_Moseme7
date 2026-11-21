const { pool } = require('../config/db');

const STOCK_SELECT = `
  SELECT st.stock_id, st.fruit_id, f.fruit_name, st.packaging_size,
         st.available_quantity, st.selling_price, st.low_stock_threshold,
         (st.available_quantity <= st.low_stock_threshold) AS is_low_stock
  FROM stock AS st
  JOIN fruits AS f ON f.fruit_id = st.fruit_id`;

async function list() {
  const [rows] = await pool.execute(`${STOCK_SELECT} ORDER BY f.fruit_name, FIELD(st.packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`);
  return rows;
}

async function listByFruit(fruitId) {
  const [rows] = await pool.execute(`${STOCK_SELECT} WHERE st.fruit_id = ? ORDER BY FIELD(st.packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`, [fruitId]);
  return rows;
}

async function listLow() {
  const [rows] = await pool.execute(`${STOCK_SELECT} WHERE st.available_quantity <= st.low_stock_threshold ORDER BY st.available_quantity, f.fruit_name`);
  return rows;
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute(`${STOCK_SELECT} WHERE st.stock_id = ?`, [id]);
  return rows[0] || null;
}

async function update(id, sellingPrice, lowStockThreshold) {
  const [result] = await pool.execute(
    'UPDATE stock SET selling_price = ?, low_stock_threshold = ? WHERE stock_id = ?',
    [sellingPrice, lowStockThreshold, id]
  );
  return result.affectedRows > 0;
}

module.exports = { list, listByFruit, listLow, findById, update };
