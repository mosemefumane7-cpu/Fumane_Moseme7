const { pool } = require('../config/db');

async function list() {
  const [rows] = await pool.execute('SELECT fruit_id, fruit_name, description, status FROM fruits ORDER BY fruit_name');
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT fruit_id, fruit_name, description, status FROM fruits WHERE fruit_id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.execute(
    'INSERT INTO fruits (fruit_name, description, status) VALUES (?, ?, ?)',
    [data.fruit_name, data.description, data.status]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const [result] = await pool.execute(
    'UPDATE fruits SET fruit_name = ?, description = ?, status = ? WHERE fruit_id = ?',
    [data.fruit_name, data.description, data.status, id]
  );
  return result.affectedRows > 0;
}

module.exports = { list, findById, create, update };
