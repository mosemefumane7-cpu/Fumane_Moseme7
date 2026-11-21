const { pool } = require('../config/db');

// Phone numbers are compared with spaces, dashes and brackets removed, so
// "+266 5811 0001" and "+26658110001" match the same registered vendor.
const STRIPPED_PHONE = "REPLACE(REPLACE(REPLACE(REPLACE(v.phone_number, ' ', ''), '-', ''), '(', ''), ')', '')";

async function findVendorByPhone(phone, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT v.vendor_id, v.vendor_name, v.phone_number, v.location FROM vendors AS v WHERE ${STRIPPED_PHONE} = ? LIMIT 1`,
    [phone]
  );
  return rows[0] || null;
}

async function findAccountByVendorId(vendorId) {
  const [rows] = await pool.execute(
    'SELECT vendor_account_id, vendor_id FROM vendor_accounts WHERE vendor_id = ?',
    [vendorId]
  );
  return rows[0] || null;
}

async function findLoginByPhone(phone) {
  const [rows] = await pool.execute(
    `SELECT a.vendor_id, a.password_hash FROM vendor_accounts AS a
     JOIN vendors AS v ON v.vendor_id = a.vendor_id WHERE ${STRIPPED_PHONE} = ? LIMIT 1`,
    [phone]
  );
  return rows[0] || null;
}

async function createAccount(vendorId, passwordHash) {
  const [result] = await pool.execute(
    'INSERT INTO vendor_accounts (vendor_id, password_hash) VALUES (?, ?)',
    [vendorId, passwordHash]
  );
  return result.insertId;
}

async function touchLogin(vendorId) {
  await pool.execute('UPDATE vendor_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE vendor_id = ?', [vendorId]);
}

async function getProfile(vendorId) {
  const [rows] = await pool.execute(
    'SELECT vendor_id, vendor_name, phone_number, location, registration_date FROM vendors WHERE vendor_id = ?',
    [vendorId]
  );
  return rows[0] || null;
}

async function listSales(vendorId) {
  const [rows] = await pool.execute(
    `SELECT sale_id, sale_date, payment_status, total_amount, amount_paid,
            GREATEST(total_amount - amount_paid, 0.00) AS outstanding_balance
     FROM sales WHERE vendor_id = ? ORDER BY sale_date DESC, sale_id DESC`,
    [vendorId]
  );
  return rows;
}

async function listPayments(vendorId, limit = 50) {
  const [rows] = await pool.execute(
    `SELECT p.payment_id, p.sale_id, p.amount, p.payment_method, p.payment_date, p.reference
     FROM payments AS p JOIN sales AS s ON s.sale_id = p.sale_id
     WHERE s.vendor_id = ? ORDER BY p.payment_date DESC, p.payment_id DESC LIMIT ${Number(limit) | 0}`,
    [vendorId]
  );
  return rows;
}

module.exports = {
  findVendorByPhone, findAccountByVendorId, findLoginByPhone, createAccount,
  touchLogin, getProfile, listSales, listPayments
};
