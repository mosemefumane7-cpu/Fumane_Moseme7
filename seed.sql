-- Run once after schema.sql. Opening stock is adjusted by every seeded purchase and sale below.
USE batloung_farm_db;

INSERT INTO suppliers (supplier_id, business_name, contact_person, phone, province, address) VALUES
  (1, 'Highveld Harvest Co.', 'Thabo Mokoena', '+27115550101', 'Gauteng', 'Johannesburg Fresh Produce Market'),
  (2, 'Free State Orchard Supply', 'Palesa Botha', '+27514550202', 'Free State', 'Bloemfontein Produce Exchange'),
  (3, 'KwaZulu Fresh Routes', 'Sibusiso Khumalo', '+27315550303', 'KwaZulu-Natal', 'Durban Market Road'),
  (4, 'Cape Valley Fruit Traders', 'Lerato Daniels', '+27215550404', 'Western Cape', 'Cape Town Produce Market'),
  (5, 'Eastern Orchard Partners', 'Aphiwe Ndlovu', '+27435550505', 'Eastern Cape', 'Gqeberha Market Square'),
  (6, 'Limpopo Sunshine Produce', 'Mpho Baloyi', '+27155550606', 'Limpopo', 'Polokwane Fresh Market'),
  (7, 'Lowveld Citrus & Fruit', 'Nomsa Dlamini', '+27135550707', 'Mpumalanga', 'Nelspruit Market Lane'),
  (8, 'North West Farm Collective', 'Kagiso Molefe', '+27185550808', 'North West', 'Rustenburg Farm Road');

INSERT INTO fruits (fruit_id, fruit_name, description, status) VALUES
  (1, 'Apples', 'Crisp South African apples packed by size.', 'ACTIVE'),
  (2, 'Bananas', 'Ripe bananas for everyday market trade.', 'ACTIVE'),
  (3, 'Oranges', 'Juicy citrus sourced from regional growers.', 'ACTIVE'),
  (4, 'Mangoes', 'Seasonal sweet mangoes, graded by box size.', 'ACTIVE'),
  (5, 'Grapes', 'Fresh table grapes for vendors and retailers.', 'ACTIVE');

INSERT INTO vendors (vendor_id, vendor_name, phone_number, location, registration_date) VALUES
  (1, 'Maseru Morning Market Stall', '+26658110001', 'Maseru Central Market', '2025-09-12'),
  (2, 'Leribe Street Produce', '+26658110002', 'Hlotse, Leribe', '2025-10-03'),
  (3, 'Mabote Corner Grocers', '+26658110003', 'Mabote, Maseru', '2025-10-18'),
  (4, 'Thetsane Fruit Basket', '+26658110004', 'Thetsane, Maseru', '2025-11-02'),
  (5, 'Roma Roadside Fresh', '+26658110005', 'Roma, Maseru District', '2025-11-15'),
  (6, 'Maputsoe Family Retail', '+26658110006', 'Maputsoe, Leribe', '2025-12-07'),
  (7, 'Ha Matala Veg & Fruit', '+26658110007', 'Ha Matala, Maseru', '2026-01-21'),
  (8, 'Berea Town Produce Stand', '+26658110008', 'Teyateyaneng, Berea', '2026-02-08');

-- Opening inventory: ledger movements below reconcile to the final balances.
INSERT INTO stock (fruit_id, packaging_size, available_quantity, selling_price, low_stock_threshold) VALUES
  (1, 'SMALL', 42, 35.00, 10), (1, 'MEDIUM', 28, 55.00, 10), (1, 'LARGE', 10, 80.00, 8),
  (2, 'SMALL', 55, 25.00, 10), (2, 'MEDIUM', 34, 40.00, 10), (2, 'LARGE', 20, 60.00, 25),
  (3, 'SMALL', 47, 30.00, 10), (3, 'MEDIUM', 30, 45.00, 10), (3, 'LARGE', 17, 65.00, 10),
  (4, 'SMALL', 24, 60.00, 10), (4, 'MEDIUM', 16, 85.00, 10), (4, 'LARGE', 10, 120.00, 10),
  (5, 'SMALL', 30, 40.00, 10), (5, 'MEDIUM', 19, 70.00, 10), (5, 'LARGE', 5, 100.00, 8);

INSERT INTO purchases (purchase_id, supplier_id, purchase_date, total_amount) VALUES
  (1, 1, '2026-11-01 07:30:00', 600.00),
  (2, 2, '2026-11-02 08:10:00', 800.00),
  (3, 3, '2026-11-03 06:45:00', 500.00),
  (4, 4, '2026-11-04 09:00:00', 440.00),
  (5, 5, '2026-11-05 07:20:00', 696.00);

INSERT INTO purchase_details (purchase_detail_id, purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES
  (1, 1, 1, 6, 50.00, 'LARGE'), (2, 1, 2, 12, 25.00, 'MEDIUM'),
  (3, 2, 3, 20, 12.00, 'SMALL'), (4, 2, 4, 8, 70.00, 'LARGE'),
  (5, 3, 1, 15, 10.00, 'SMALL'), (6, 3, 5, 10, 35.00, 'MEDIUM'),
  (7, 4, 2, 8, 30.00, 'LARGE'), (8, 4, 3, 10, 20.00, 'MEDIUM'),
  (9, 5, 1, 3, 48.00, 'LARGE'), (10, 5, 5, 14, 18.00, 'SMALL'), (11, 5, 4, 12, 25.00, 'SMALL');

UPDATE stock AS s
JOIN (
  SELECT pd.fruit_id, pd.packaging_size, SUM(pd.quantity) AS quantity_received
  FROM purchase_details AS pd
  GROUP BY pd.fruit_id, pd.packaging_size
) AS received ON received.fruit_id = s.fruit_id AND received.packaging_size = s.packaging_size
SET s.available_quantity = s.available_quantity + received.quantity_received;

INSERT INTO sales (sale_id, vendor_id, sale_date, payment_status, total_amount, amount_paid) VALUES
  (1, 1, '2026-11-06 08:15:00', 'PAID', 440.00, 440.00),
  (2, 2, '2026-11-07 09:20:00', 'PARTIALLY_PAID', 390.00, 200.00),
  (3, 3, '2026-11-08 10:05:00', 'UNPAID', 380.00, 0.00),
  (4, 1, '2026-11-09 08:40:00', 'PAID', 390.00, 390.00),
  (5, 4, '2026-11-10 11:30:00', 'PARTIALLY_PAID', 360.00, 100.00),
  (6, 5, '2026-11-11 07:55:00', 'UNPAID', 360.00, 0.00),
  (7, 6, '2026-11-12 09:10:00', 'PAID', 405.00, 405.00),
  (8, 2, '2026-11-13 08:25:00', 'PAID', 500.00, 500.00);

INSERT INTO sales_details (sales_detail_id, sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES
  (1, 1, 1, 'LARGE', 4, 80.00), (2, 1, 2, 'MEDIUM', 3, 40.00),
  (3, 2, 1, 'LARGE', 3, 80.00), (4, 2, 3, 'SMALL', 5, 30.00),
  (5, 3, 2, 'LARGE', 4, 60.00), (6, 3, 5, 'MEDIUM', 2, 70.00),
  (7, 4, 1, 'SMALL', 6, 35.00), (8, 4, 3, 'MEDIUM', 4, 45.00),
  (9, 5, 4, 'LARGE', 2, 120.00), (10, 5, 5, 'SMALL', 3, 40.00),
  (11, 6, 1, 'LARGE', 2, 80.00), (12, 6, 2, 'SMALL', 8, 25.00),
  (13, 7, 1, 'MEDIUM', 5, 55.00), (14, 7, 3, 'LARGE', 2, 65.00),
  (15, 8, 1, 'LARGE', 4, 80.00), (16, 8, 4, 'SMALL', 3, 60.00);

UPDATE stock AS s
JOIN (
  SELECT sd.fruit_id, sd.packaging_size, SUM(sd.quantity) AS quantity_sold
  FROM sales_details AS sd
  GROUP BY sd.fruit_id, sd.packaging_size
) AS sold ON sold.fruit_id = s.fruit_id AND sold.packaging_size = s.packaging_size
SET s.available_quantity = s.available_quantity - sold.quantity_sold;

INSERT INTO payments (payment_id, sale_id, amount, payment_method, payment_date, reference) VALUES
  (1, 1, 440.00, 'CASH', '2026-11-06 08:20:00', 'CASH-0001'),
  (2, 2, 200.00, 'MOBILE_MONEY', '2026-11-07 09:35:00', 'MM-0002'),
  (3, 4, 390.00, 'CASH', '2026-11-09 08:50:00', 'CASH-0004'),
  (4, 5, 100.00, 'MOBILE_MONEY', '2026-11-10 11:45:00', 'MM-0005'),
  (5, 7, 405.00, 'CASH', '2026-11-12 09:15:00', 'CASH-0007'),
  (6, 8, 500.00, 'MOBILE_MONEY', '2026-11-13 08:40:00', 'MM-0008');

-- Expected final check: Apples/LARGE = 10 opening + 9 purchased - 13 sold = 6.
SELECT f.fruit_name, s.packaging_size, s.available_quantity, s.low_stock_threshold, s.selling_price
FROM stock AS s
JOIN fruits AS f ON f.fruit_id = s.fruit_id
ORDER BY f.fruit_id, FIELD(s.packaging_size, 'SMALL', 'MEDIUM', 'LARGE');
