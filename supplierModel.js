const { pool } = require('../config/db');

async function list() {
  const [rows] = await pool.execute('SELECT supplier_id, business_name, contact_person, phone, province, address, created_at FROM suppliers ORDER BY business_name');
  return rows;
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute('SELECT supplier_id, business_name, contact_person, phone, province, address, created_at FROM suppliers WHERE supplier_id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.execute(
    'INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES (?, ?, ?, ?, ?)',
    [data.business_name, data.contact_person, data.phone, data.province, data.address]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const [result] = await pool.execute(
    'UPDATE suppliers SET business_name = ?, contact_person = ?, phone = ?, province = ?, address = ? WHERE supplier_id = ?',
    [data.business_name, data.contact_person, data.phone, data.province, data.address, id]
  );
  return result.affectedRows > 0;
}

async function hasPurchases(id, executor = pool) {
  const [rows] = await executor.execute('SELECT 1 FROM purchases WHERE supplier_id = ? LIMIT 1', [id]);
  return rows.length > 0;
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM suppliers WHERE supplier_id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { list, findById, create, update, hasPurchases, remove };
