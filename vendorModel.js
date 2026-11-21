const { pool } = require('../config/db');

async function list() {
  const [rows] = await pool.execute('SELECT vendor_id, vendor_name, phone_number, location, registration_date FROM vendors ORDER BY vendor_name');
  return rows;
}

async function findById(id, executor = pool) {
  const [rows] = await executor.execute('SELECT vendor_id, vendor_name, phone_number, location, registration_date FROM vendors WHERE vendor_id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.execute('INSERT INTO vendors (vendor_name, phone_number, location) VALUES (?, ?, ?)', [data.vendor_name, data.phone_number, data.location]);
  return findById(result.insertId);
}

async function update(id, data) {
  const [result] = await pool.execute('UPDATE vendors SET vendor_name = ?, phone_number = ?, location = ? WHERE vendor_id = ?', [data.vendor_name, data.phone_number, data.location, id]);
  return result.affectedRows > 0;
}

async function search(query) {
  const term = `%${query}%`;
  const [rows] = await pool.execute(
    'SELECT vendor_id, vendor_name, phone_number, location, registration_date FROM vendors WHERE vendor_name LIKE ? OR phone_number LIKE ? ORDER BY vendor_name LIMIT 100',
    [term, term]
  );
  return rows;
}

async function getBalance(id) {
  const [rows] = await pool.execute(
    `SELECT v.vendor_id, v.vendor_name,
            COALESCE(SUM(s.total_amount), 0.00) AS total_sales,
            COALESCE(SUM(COALESCE(p.paid_amount, 0.00)), 0.00) AS total_paid,
            GREATEST(COALESCE(SUM(s.total_amount), 0.00) - COALESCE(SUM(COALESCE(p.paid_amount, 0.00)), 0.00), 0.00) AS outstanding_balance
     FROM vendors AS v
     LEFT JOIN sales AS s ON s.vendor_id = v.vendor_id
     LEFT JOIN (SELECT sale_id, SUM(amount) AS paid_amount FROM payments GROUP BY sale_id) AS p ON p.sale_id = s.sale_id
     WHERE v.vendor_id = ? GROUP BY v.vendor_id, v.vendor_name`, [id]
  );
  return rows[0] || null;
}

async function listOutstanding() {
  const [rows] = await pool.execute(
    `SELECT v.vendor_id, v.vendor_name, v.phone_number,
            SUM(s.total_amount) AS total_sales,
            SUM(COALESCE(p.paid_amount, 0.00)) AS total_paid,
            SUM(s.total_amount - COALESCE(p.paid_amount, 0.00)) AS outstanding_balance
     FROM vendors AS v JOIN sales AS s ON s.vendor_id = v.vendor_id
     LEFT JOIN (SELECT sale_id, SUM(amount) AS paid_amount FROM payments GROUP BY sale_id) AS p ON p.sale_id = s.sale_id
     GROUP BY v.vendor_id, v.vendor_name, v.phone_number
     HAVING outstanding_balance > 0 ORDER BY outstanding_balance DESC, v.vendor_name`
  );
  return rows;
}

module.exports = { list, findById, create, update, search, getBalance, listOutstanding };
