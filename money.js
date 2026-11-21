function toCents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function lineTotalCents(quantity, unitPrice) {
  return Number(quantity) * toCents(unitPrice);
}

module.exports = { toCents, fromCents, lineTotalCents };
