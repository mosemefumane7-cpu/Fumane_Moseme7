const mysql = require('mysql2/promise');
const { logger } = require('../utils/logger');

const sslOptions = process.env.DB_SSL === 'true'
  ? {
      rejectUnauthorized: true,
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {})
    }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'batloung',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'batloung_farm_db',
  waitForConnections: true,
  connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  ssl: sslOptions,
  decimalNumbers: true,
  dateStrings: false
});

let databaseReady = false;
let lastCheckedAt = null;
let retryLoopStarted = false;
let consecutiveFailures = 0;

function getDatabaseStatus() {
  return {
    connected: databaseReady,
    lastCheckedAt,
    message: databaseReady ? 'Database connection is available.' : 'Database is not connected; data routes are temporarily unavailable.'
  };
}

function markDatabaseUnavailable() {
  databaseReady = false;
  lastCheckedAt = new Date().toISOString();
}

async function probeDatabase() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1');
    databaseReady = true;
    consecutiveFailures = 0;
    lastCheckedAt = new Date().toISOString();
    return true;
  } catch (error) {
    databaseReady = false;
    consecutiveFailures += 1;
    lastCheckedAt = new Date().toISOString();
    if (consecutiveFailures === 1 || consecutiveFailures % 5 === 0) {
      logger.error(`MySQL connection attempt ${consecutiveFailures} failed; retrying in the background`, error);
    }
    return false;
  } finally {
    if (connection) connection.release();
  }
}

async function startDatabaseMonitor() {
  if (retryLoopStarted) return;
  retryLoopStarted = true;
  // Keep HTTP availability independent of MySQL: failed probes are retried and never stop startup.
  while (true) {
    const connected = await probeDatabase();
    const delay = connected ? 15000 : Math.min(30000, 2000 * (2 ** Math.min(consecutiveFailures - 1, 4)));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, getDatabaseStatus, markDatabaseUnavailable, probeDatabase, startDatabaseMonitor, closePool };
