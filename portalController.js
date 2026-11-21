const bcrypt = require('bcryptjs');
const AppError = require('../middleware/AppError');
const { requireObject, positiveId, nonNegativeMoney } = require('../middleware/validators');
const { validateNewPassword } = require('../middleware/accountValidators');
const {
  VENDOR_COOKIE_NAME, vendorCookieOptions, clearVendorCookieOptions, createVendorToken, newCsrfToken
} = require('../middleware/vendorAuth');
const vendorAccountModel = require('../models/vendorAccountModel');
const vendorModel = require('../models/vendorModel');
const salesModel = require('../models/salesModel');
const paymentModel = require('../models/paymentModel');
const paymentService = require('../services/paymentService');
const { toCents } = require('../utils/money');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// "58110001", "266 5811 0001", "+266-5811-0001" and "00266 58110001" all become +26658110001.
function normalizePhone(value) {
  if (typeof value !== 'string' || !value.trim()) throw new AppError(400, 'Phone number is required.');
  let phone = value.replace(/[\s\-().]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (/^\d{8}$/.test(phone)) phone = `+266${phone}`;
  else if (/^266\d{8}$/.test(phone)) phone = `+${phone}`;
  if (!/^\+?\d{8,15}$/.test(phone)) throw new AppError(400, 'Enter a valid phone number, for example +266 5811 0001.');
  return phone;
}

function startSession(res, vendorId) {
  const csrfToken = newCsrfToken();
  res.cookie(VENDOR_COOKIE_NAME, createVendorToken(vendorId, csrfToken), vendorCookieOptions());
  return csrfToken;
}

async function profileResponse(vendorId, csrfToken) {
  const vendor = await vendorAccountModel.getProfile(vendorId);
  if (!vendor) throw new AppError(401, 'This account no longer exists. Please sign in again.');
  return { vendor, csrfToken };
}

async function register(req, res) {
  const body = requireObject(req.body);
  const phone = normalizePhone(body.phone);
  const password = validateNewPassword(body.password);
  const vendor = await vendorAccountModel.findVendorByPhone(phone);
  if (!vendor) {
    throw new AppError(404, 'No registered vendor uses that phone number. Ask Batloung Farm to register your business first.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await vendorAccountModel.createAccount(vendor.vendor_id, passwordHash);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'This vendor already has a portal account. Please sign in.');
    throw error;
  }
  const csrfToken = startSession(res, vendor.vendor_id);
  res.status(201).json({ success: true, data: await profileResponse(vendor.vendor_id, csrfToken) });
}

async function login(req, res) {
  const body = requireObject(req.body);
  const phone = normalizePhone(body.phone);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) throw new AppError(400, 'Phone number and password are required.');
  const account = await vendorAccountModel.findLoginByPhone(phone);
  const matches = await bcrypt.compare(password, account ? account.password_hash : DUMMY_HASH);
  if (!account || !matches) throw new AppError(401, 'The phone number or password is incorrect.');
  await vendorAccountModel.touchLogin(account.vendor_id);
  const csrfToken = startSession(res, account.vendor_id);
  res.json({ success: true, data: await profileResponse(account.vendor_id, csrfToken) });
}

function logout(_req, res) {
  res.clearCookie(VENDOR_COOKIE_NAME, clearVendorCookieOptions());
  res.json({ success: true, message: 'You have been signed out.' });
}

async function me(req, res) {
  res.json({ success: true, data: await profileResponse(req.vendor.vendor_id, req.vendor.csrfToken) });
}

async function summary(req, res) {
  const vendorId = req.vendor.vendor_id;
  const [balance, sales, payments] = await Promise.all([
    vendorModel.getBalance(vendorId),
    vendorAccountModel.listSales(vendorId),
    vendorAccountModel.listPayments(vendorId, 10)
  ]);
  res.json({
    success: true,
    data: {
      total_sales: balance ? balance.total_sales : 0,
      total_paid: balance ? balance.total_paid : 0,
      outstanding_balance: balance ? balance.outstanding_balance : 0,
      open_sales: sales.filter((sale) => sale.outstanding_balance > 0).length,
      recent_payments: payments
    }
  });
}

async function listSales(req, res) {
  res.json({ success: true, data: await vendorAccountModel.listSales(req.vendor.vendor_id) });
}

// A vendor can only ever see their own sales; anything else is reported as "not found".
async function ownedSale(req) {
  const saleId = positiveId(req.params.id, 'Sale id');
  const sale = await salesModel.findById(saleId);
  if (!sale || sale.vendor_id !== req.vendor.vendor_id) throw new AppError(404, 'Sale not found.');
  return sale;
}

async function getSale(req, res) {
  const sale = await ownedSale(req);
  const payments = await paymentModel.listForSale(sale.sale_id);
  res.json({ success: true, data: { ...sale, payments } });
}

async function pay(req, res) {
  const sale = await ownedSale(req);
  const body = requireObject(req.body);
  const amount = nonNegativeMoney(body.amount, 'Payment amount');
  if (amount <= 0) throw new AppError(400, 'Payment amount must be greater than zero.');
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (reference.length < 4 || reference.length > 80) {
    throw new AppError(400, 'Enter the mobile money transaction reference (4 to 80 characters).');
  }
  if (toCents(amount) > toCents(sale.outstanding_balance)) {
    throw new AppError(409, `Payment exceeds the outstanding balance of ${Number(sale.outstanding_balance).toFixed(2)}.`);
  }
  // Vendor payments are always mobile money and are tagged so staff can verify them.
  const result = await paymentService.recordPayment(sale.sale_id, {
    amount, method: 'MOBILE_MONEY', reference: `Vendor portal: ${reference}`
  });
  res.status(201).json({ success: true, data: result });
}

module.exports = { normalizePhone, register, login, logout, me, summary, listSales, getSale, pay };
