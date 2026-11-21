USE batloung_farm_db;

-- Raw SQL outline of the sale transaction. In the application, all statements
-- between START TRANSACTION and COMMIT execute on the same checked-out connection.
-- BEGIN establishes an atomic unit; COMMIT makes every row change durable;
-- ROLLBACK discards all uncommitted changes if validation or SQL fails.
START TRANSACTION;

-- Lock each requested (fruit_id, packaging_size) row until commit/rollback.
-- Demo request: Apples/SMALL x 2, Bananas/SMALL x 3, Apples/LARGE x 10.
-- The third line deliberately requests more than the seeded 6 Apples/LARGE.
SELECT st.stock_id, f.fruit_name, st.packaging_size,
       st.available_quantity, st.selling_price
FROM stock AS st
JOIN fruits AS f ON f.fruit_id = st.fruit_id
WHERE (st.fruit_id = 1 AND st.packaging_size = 'SMALL')
   OR (st.fruit_id = 2 AND st.packaging_size = 'SMALL')
   OR (st.fruit_id = 1 AND st.packaging_size = 'LARGE')
ORDER BY st.fruit_id, st.packaging_size
FOR UPDATE;

-- Application validation compares each requested quantity with the locked rows.
-- For this demonstration Apples/LARGE has 6 and the third request asks for 10.
-- Crucially, no sale, detail, payment, or stock update has been issued yet.
-- In the failure branch, abort the entire unit of work:
ROLLBACK;

-- A real successful-sale branch (not run in the failing demo) validates every row
-- first, then performs guarded decrements, inserts a sale and details, records any
-- initial payment, recomputes payment status, and commits. A stock decrement can
-- also be guarded in SQL as shown below; the affected-row count must be exactly 1:
-- UPDATE stock SET available_quantity = available_quantity - ?
-- WHERE stock_id = ? AND available_quantity >= ?;
-- INSERT INTO sales (...);
-- INSERT INTO sales_details (...);
-- INSERT INTO payments (...); -- if the request includes a valid payment
-- COMMIT;
