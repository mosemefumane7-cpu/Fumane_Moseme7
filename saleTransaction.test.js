const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../config/db');
const vendorModel = require('../models/vendorModel');
const salesModel = require('../models/salesModel');
const saleService = require('../services/saleService');

test('a third-line stock shortage rolls back before any stock decrement or sale insert', async (t) => {
  const originalGetConnection = pool.getConnection;
  const originalFindVendor = vendorModel.findById;
  const originalLockStock = salesModel.lockStockRows;
  const originalDecrement = salesModel.decrementStock;
  const originalCreateHeader = salesModel.createHeader;
  const originalCreateDetail = salesModel.createDetail;
  const counts = { begin: 0, commit: 0, rollback: 0, release: 0, decrements: 0, headers: 0, details: 0 };
  const connection = {
    async beginTransaction() { counts.begin += 1; },
    async commit() { counts.commit += 1; },
    async rollback() { counts.rollback += 1; },
    release() { counts.release += 1; }
  };
  t.after(() => {
    pool.getConnection = originalGetConnection;
    vendorModel.findById = originalFindVendor;
    salesModel.lockStockRows = originalLockStock;
    salesModel.decrementStock = originalDecrement;
    salesModel.createHeader = originalCreateHeader;
    salesModel.createDetail = originalCreateDetail;
  });

  pool.getConnection = async () => connection;
  vendorModel.findById = async () => ({ vendor_id: 1 });
  salesModel.lockStockRows = async () => [
    { stock_id: 1, fruit_id: 1, fruit_name: 'Apples', packaging_size: 'SMALL', available_quantity: 42, selling_price: 35 },
    { stock_id: 2, fruit_id: 2, fruit_name: 'Bananas', packaging_size: 'SMALL', available_quantity: 55, selling_price: 25 },
    { stock_id: 3, fruit_id: 1, fruit_name: 'Apples', packaging_size: 'LARGE', available_quantity: 6, selling_price: 80 }
  ];
  salesModel.decrementStock = async () => { counts.decrements += 1; return true; };
  salesModel.createHeader = async () => { counts.headers += 1; return 999; };
  salesModel.createDetail = async () => { counts.details += 1; };

  await assert.rejects(
    saleService.createSale({
      vendor_id: 1,
      items: [
        { fruit_id: 1, packaging_size: 'SMALL', quantity: 2 },
        { fruit_id: 2, packaging_size: 'SMALL', quantity: 3 },
        { fruit_id: 1, packaging_size: 'LARGE', quantity: 10 }
      ]
    }),
    /Requested 10 LARGE Apples, only 6 available/
  );

  assert.deepEqual(counts, { begin: 1, commit: 0, rollback: 1, release: 1, decrements: 0, headers: 0, details: 0 });
});
