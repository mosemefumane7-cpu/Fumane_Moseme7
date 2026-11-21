const test = require("node:test");
const assert = require("node:assert/strict");

// Replace the database-backed modules with in-memory fakes before the portal code loads.
function stub(relativePath, exports) {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

const recorded = [];
const sales = {
  10: { sale_id: 10, vendor_id: 1, total_amount: 100, amount_paid: 40, outstanding_balance: 60, items: [] },
  11: { sale_id: 11, vendor_id: 2, total_amount: 50, amount_paid: 0, outstanding_balance: 50, items: [] },
};
stub("../models/salesModel", { findById: async (id) => sales[id] || null });
stub("../models/paymentModel", { listForSale: async () => [] });
stub("../models/vendorModel", { getBalance: async () => null });
stub("../models/vendorAccountModel", {
  findAccountByVendorId: async (id) => (id === 1 ? { vendor_id: 1 } : null),
});
stub("../services/paymentService", {
  recordPayment: async (saleId, input) => {
    recorded.push({ saleId, input });
    return { sale_id: saleId, amount: input.amount, outstanding_balance: 0 };
  },
});

const portal = require("../controllers/portalController");
const { requireVendorCsrf, createVendorToken, VENDOR_COOKIE_NAME } = require("../middleware/vendorAuth");
const { requireAuth } = require("../middleware/auth");

process.env.JWT_SECRET = "x".repeat(40);

function call(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    Promise.resolve(handler(req, res)).catch((error) => resolve({ error }));
  });
}
const vendorReq = (vendorId, params, body) => ({ vendor: { vendor_id: vendorId }, params, body });

test("phone numbers are normalised to the +266 form", () => {
  for (const input of ["58110001", "+266 5811 0001", "266-5811-0001", "00266 58110001", "+26658110001"]) {
    assert.equal(portal.normalizePhone(input), "+26658110001", input);
  }
  assert.throws(() => portal.normalizePhone("abc"), { statusCode: 400 });
  assert.throws(() => portal.normalizePhone(""), { statusCode: 400 });
});

test("a vendor cannot open or pay another vendor's sale", async () => {
  const view = await call(portal.getSale, vendorReq(1, { id: "11" }));
  assert.equal(view.error.statusCode, 404);
  const pay = await call(portal.pay, vendorReq(1, { id: "11" }, { amount: 10, reference: "MP12345" }));
  assert.equal(pay.error.statusCode, 404);
  assert.equal(recorded.length, 0);
});

test("payments above the balance, or without a reference, are rejected", async () => {
  const over = await call(portal.pay, vendorReq(1, { id: "10" }, { amount: 60.01, reference: "MP12345" }));
  assert.equal(over.error.statusCode, 409);
  const noRef = await call(portal.pay, vendorReq(1, { id: "10" }, { amount: 10, reference: "" }));
  assert.equal(noRef.error.statusCode, 400);
  const zero = await call(portal.pay, vendorReq(1, { id: "10" }, { amount: 0, reference: "MP12345" }));
  assert.equal(zero.error.statusCode, 400);
  assert.equal(recorded.length, 0);
});

test("a valid vendor payment is recorded as tagged mobile money", async () => {
  const result = await call(portal.pay, vendorReq(1, { id: "10" }, { amount: 60, reference: "MP12345" }));
  assert.equal(result.status, 201);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].saleId, 10);
  assert.equal(recorded[0].input.method, "MOBILE_MONEY");
  assert.equal(recorded[0].input.amount, 60);
  assert.match(recorded[0].input.reference, /^Vendor portal: MP12345$/);
});

test("vendor CSRF check blocks unsafe requests without a matching token", () => {
  const run = (method, provided) => {
    let result;
    requireVendorCsrf(
      { method, vendor: { csrfToken: "abc" }, get: () => provided },
      {},
      (error) => { result = error; }
    );
    return result;
  };
  assert.equal(run("GET"), undefined);
  assert.equal(run("POST", "abc"), undefined);
  assert.equal(run("POST", "nope").statusCode, 403);
  assert.equal(run("POST").statusCode, 403);
});

test("a vendor session token is refused by the staff/admin middleware", () => {
  const token = createVendorToken(1, "csrf");
  let error;
  requireAuth({ cookies: { batloung_session: token }, get: () => "" }, {}, (e) => { error = e; });
  assert.equal(error.statusCode, 401);
  error = undefined;
  requireAuth({ cookies: {}, get: (h) => (h.toLowerCase() === "authorization" ? `Bearer ${token}` : "") }, {}, (e) => { error = e; });
  assert.equal(error.statusCode, 401);
  assert.equal(VENDOR_COOKIE_NAME, "batloung_vendor_session");
});
