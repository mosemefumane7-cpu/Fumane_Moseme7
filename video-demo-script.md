# Five-minute video demo script

## 0:00–0:40 — What Batloung does

“Batloung Farm distributes fruit from South African suppliers to street vendors and small retailers in Lesotho. This admin desk keeps stock, orders and vendor balances together. I’ll show the database, the API structure, then a purchase, two sales, the payment flow and the reports.”

## 0:40–1:20 — Schema and project structure

Open `database/schema.sql` and point out the ten tables: suppliers, fruits, vendors, purchases, purchase details, sales, sales details, stock, payments and users. Explain that stock has a unique fruit/packaging-size row, so SMALL, MEDIUM and LARGE are counted and priced independently. Show the purchase foreign key’s `ON DELETE RESTRICT`, the purchase-details cascade, indexes and quantity/payment checks. Open `database/seed.sql` and show that the opening stock plus five purchases minus eight sales reconciles. Apples/LARGE ends at 6; that value is reserved for the rollback demonstration.

Show `config/db.js`, `routes/`, `controllers/`, `models/`, `middleware/`, `services/` and `public/`. Explain that SQL remains parameterized in model files and the plain HTML/CSS/JavaScript dashboard is served from Express without a bundler. `server.js` can stay up while MySQL is unavailable; DB-dependent routes return 503 and the connection monitor keeps retrying.

## 1:20–2:05 — API and receiving a purchase

Show `api-tests.http` and the `/api` route groups: suppliers, fruits, stock, vendors, purchases, sales, payments and reports. Sign in as the administrator (on an empty database, the first account you register becomes the administrator) so the session cookie is available. In the Purchase view, select a supplier and enter two fruit/size lines with quantities and unit costs. Point out the client’s live estimate, then save. The server recomputes the amount, saves the header/details, and increases stock inside one transaction. Confirm the new receipt in Purchase history and the updated Stock view.

## 2:05–2:45 — Successful sale and rejected sale

Create a normal sale for a vendor using a fruit/size that has stock. Explain that the browser sends fruit, packaging size and quantity only; the server locks inventory and reads the selling price from the stock table. Save a partial initial payment and show the new sale badge.

Run `node scripts/demo-rollback.js` against a clean seeded database before creating a purchase that changes Apples/LARGE. It requests three lines; the third line asks for 10 LARGE Apples even though only 6 are available. The expected response is HTTP 409 with `Requested 10 LARGE Apples, only 6 available.` The demo reads stock and sales before and after and confirms no new sale exists and the first two lines’ stock did not change. Show `services/saleService.js` and `database/transaction_demo.sql`: all requested rows are locked and checked before writes, and any failure rolls back the transaction.

## 2:45–3:35 — Payments and vendor balances

Open Sales & payments. Record a payment against a partially-paid sale and show the status moving to PAID when the remaining balance is settled. Point out that an amount above the balance is rejected, payments are added within a transaction, and the status/amount-paid fields are recomputed from payment rows. Open Vendors to show outstanding balances derived from sale totals less `SUM(payments)`.

## 3:35–4:35 — The four reports

Open Reports and choose a date range. Show total sales revenue for the inclusive range. Then point out the top five fruit lines ranked by summed quantity; the top vendor ranked by boxes sold to that vendor; and current stock by fruit and package size, including low-stock flags. On the Overview page, show the matching KPI cards and the 30-day revenue/top-fruit charts.

## Optional — Accounts and read-only staff

In a private window, register a second account and show the “Read-only staff” badge: every page is visible, but forms and edit buttons are hidden and any change request returns 403. Back in the administrator window, open Team and use “Make administrator”. Point out that the last administrator cannot be demoted.

## 4:35–5:00 — Wrap-up

“Batloung can be run locally with `npm install` and `npm run dev` after `.env` is configured and the MySQL schema and seed are loaded. The deployment guide covers Render plus a hosted MySQL provider, environment settings, and a GitHub push. The main point is that inventory changes, sale details and payments stay consistent because they’re validated and saved together.”
