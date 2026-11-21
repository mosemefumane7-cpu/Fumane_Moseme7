const { pool } = require('../config/db');

async function topFruits() {
  const [rows] = await pool.execute(
    `SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity) AS quantity_sold
     FROM sales_details AS sd JOIN fruits AS f ON f.fruit_id = sd.fruit_id
     GROUP BY f.fruit_id, f.fruit_name
     ORDER BY quantity_sold DESC, f.fruit_name ASC LIMIT 5`
  );
  return rows;
}

async function revenue(from, to) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(SUM(total_amount), 0.00) AS revenue
     FROM sales WHERE sale_date >= CONCAT(?, ' 00:00:00')
       AND sale_date < DATE_ADD(?, INTERVAL 1 DAY)`, [from, to]
  );
  return rows[0];
}

async function revenueTrend(from, to) {
  const [rows] = await pool.execute(
    `SELECT DATE(sale_date) AS revenue_date, SUM(total_amount) AS revenue
     FROM sales WHERE sale_date >= CONCAT(?, ' 00:00:00')
       AND sale_date < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY DATE(sale_date) ORDER BY revenue_date`, [from, to]
  );
  return rows;
}

async function topVendor() {
  const [rows] = await pool.execute(
    `SELECT v.vendor_id, v.vendor_name, v.phone_number, SUM(sd.quantity) AS boxes_purchased
     FROM vendors AS v JOIN sales AS s ON s.vendor_id = v.vendor_id
     JOIN sales_details AS sd ON sd.sale_id = s.sale_id
     GROUP BY v.vendor_id, v.vendor_name, v.phone_number
     ORDER BY boxes_purchased DESC, v.vendor_name ASC LIMIT 1`
  );
  return rows[0] || null;
}

async function stockLevels() {
  const [rows] = await pool.execute(
    `SELECT f.fruit_id, f.fruit_name, st.stock_id, st.packaging_size,
            st.available_quantity, st.low_stock_threshold, st.selling_price,
            (st.available_quantity <= st.low_stock_threshold) AS is_low_stock
     FROM stock AS st JOIN fruits AS f ON f.fruit_id = st.fruit_id
     ORDER BY f.fruit_name, FIELD(st.packaging_size, 'SMALL', 'MEDIUM', 'LARGE')`
  );
  return rows;
}

module.exports = { topFruits, revenue, revenueTrend, topVendor, stockLevels };
