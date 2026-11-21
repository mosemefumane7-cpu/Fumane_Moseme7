const { pool } = require("../config/db");

const COLUMNS = "user_id, username, full_name, role, created_at";

async function countUsers() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM users");
  return Number(rows[0].total);
}

async function findByUsername(username) {
  const [rows] = await pool.query(
    "SELECT user_id, username, full_name, password_hash, role FROM users WHERE username = ?",
    [username],
  );
  return rows[0] || null;
}

async function findById(userId) {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM users WHERE user_id = ?`,
    [userId],
  );
  return rows[0] || null;
}

async function listUsers() {
  const [rows] = await pool.query(
    `SELECT ${COLUMNS} FROM users ORDER BY created_at, user_id`,
  );
  return rows;
}

// The very first account becomes the administrator. The single INSERT ... SELECT
// only inserts when the table is empty, so two people registering at the same
// moment can never both become admin.
async function createUser({ username, fullName, passwordHash }) {
  const [first] = await pool.query(
    `INSERT INTO users (username, full_name, password_hash, role)
     SELECT ?, ?, ?, 'admin' FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM users)`,
    [username, fullName, passwordHash],
  );
  if (first.affectedRows === 1) return findById(first.insertId);
  const [next] = await pool.query(
    "INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, 'staff')",
    [username, fullName, passwordHash],
  );
  return findById(next.insertId);
}

// Returns "not_found", "last_admin" or the updated user.
async function setRole(userId, role) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT user_id, role FROM users WHERE user_id = ? FOR UPDATE",
      [userId],
    );
    if (!rows[0]) {
      await connection.rollback();
      return "not_found";
    }
    if (rows[0].role === "admin" && role !== "admin") {
      const [admins] = await connection.query(
        "SELECT user_id FROM users WHERE role = 'admin' FOR UPDATE",
      );
      if (admins.length <= 1) {
        await connection.rollback();
        return "last_admin";
      }
    }
    await connection.query("UPDATE users SET role = ? WHERE user_id = ?", [
      role,
      userId,
    ]);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
  return findById(userId);
}

module.exports = {
  countUsers,
  findByUsername,
  findById,
  listUsers,
  createUser,
  setRole,
};
