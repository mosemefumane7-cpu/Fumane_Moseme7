USE batloung_farm_db;

-- 1. Top 5 fruit varieties by total boxes/units sold.
SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity) AS quantity_sold
FROM sales_details AS sd
JOIN fruits AS f ON f.fruit_id = sd.fruit_id
GROUP BY f.fruit_id, f.fruit_name
ORDER BY quantity_sold DESC, f.fruit_name ASC
LIMIT 5;

-- 2. Revenue means value of sales recorded in the selected sale-date window.
-- Bind ? placeholders to the inclusive start and end dates in application code.
SELECT COALESCE(SUM(s.total_amount), 0.00) AS revenue
FROM sales AS s
WHERE s.sale_date >= CONCAT(?, ' 00:00:00')
  AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY);

-- Dashboard support: daily sales-revenue buckets for an inclusive date range.
SELECT DATE(s.sale_date) AS revenue_date, SUM(s.total_amount) AS revenue
FROM sales AS s
WHERE s.sale_date >= CONCAT(?, ' 00:00:00')
  AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)
GROUP BY DATE(s.sale_date)
ORDER BY revenue_date;

-- 3. Vendors with the highest number of fruit boxes purchased from Batloung.
SELECT v.vendor_id, v.vendor_name, v.phone_number, COALESCE(SUM(sd.quantity), 0) AS boxes_purchased
FROM vendors AS v
JOIN sales AS s ON s.vendor_id = v.vendor_id
JOIN sales_details AS sd ON sd.sale_id = s.sale_id
GROUP BY v.vendor_id, v.vendor_name, v.phone_number
ORDER BY boxes_purchased DESC, v.vendor_name ASC
LIMIT 1;

-- 4. Current inventory by fruit and packaging size, with the low-stock indicator.
SELECT f.fruit_id, f.fruit_name, st.packaging_size, st.available_quantity,
       st.low_stock_threshold, st.selling_price,
       (st.available_quantity <= st.low_stock_threshold) AS is_low_stock
FROM stock AS st
JOIN fruits AS f ON f.fruit_id = st.fruit_id
ORDER BY f.fruit_name, FIELD(st.packaging_size, 'SMALL', 'MEDIUM', 'LARGE');
