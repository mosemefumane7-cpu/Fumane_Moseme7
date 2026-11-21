const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSaleTotals } = require('../utils/saleTotals');
const { positiveInteger, nonNegativeMoney } = require('../middleware/validators');

const stock = [
  { stock_id: 1, fruit_id: 1, fruit_name: 'Apples', packaging_size: 'LARGE', available_quantity: 6, selling_price: 80 },
  { stock_id: 2, fruit_id: 2, fruit_name: 'Bananas', packaging_size: 'SMALL', available_quantity: 25, selling_price: 25 }
];

test('sale totals use stock prices and round line/grand totals to cents', () => {
  const result = computeSaleTotals([
    { fruit_id: 1, packaging_size: 'LARGE', quantity: 2 },
    { fruit_id: 2, packaging_size: 'SMALL', quantity: 3 }
  ], stock);
  assert.equal(result.total_amount, 235);
  assert.deepEqual(result.lines.map((line) => line.line_total), [160, 75]);
  assert.deepEqual(result.lines.map((line) => line.unit_price), [80, 25]);
});

test('sale totals report the requested quantity and available stock', () => {
  assert.throws(() => computeSaleTotals([
    { fruit_id: 2, packaging_size: 'SMALL', quantity: 2 },
    { fruit_id: 1, packaging_size: 'LARGE', quantity: 10 }
  ], stock), /Requested 10 LARGE Apples, only 6 available/);
});

test('duplicate fruit/size lines are checked against their combined quantity', () => {
  assert.throws(() => computeSaleTotals([
    { fruit_id: 1, packaging_size: 'LARGE', quantity: 4 },
    { fruit_id: 1, packaging_size: 'LARGE', quantity: 3 }
  ], stock), /Requested 7 LARGE Apples, only 6 available/);
});

test('JSON quantities and money must be numeric rather than string-coerced', () => {
  assert.equal(positiveInteger(3, 'quantity'), 3);
  assert.throws(() => positiveInteger('3', 'quantity'), /positive whole number/);
  assert.equal(nonNegativeMoney(12.5, 'price'), 12.5);
  assert.throws(() => nonNegativeMoney('12.50', 'price'), /non-negative number/);
});
