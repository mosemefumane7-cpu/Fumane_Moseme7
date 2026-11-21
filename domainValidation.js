const AppError = require('../middleware/AppError');
const { requireNonEmptyString, requireEnum, positiveId, positiveInteger, nonNegativeMoney } = require('../middleware/validators');

const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West'];
const PACKAGING_SIZES = ['SMALL', 'MEDIUM', 'LARGE'];
const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'CREDIT'];
const FRUIT_STATUSES = ['ACTIVE', 'INACTIVE'];

function optionalText(value, label, maxLength = 255) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) throw new AppError(400, `${label} must be text of ${maxLength} characters or fewer.`);
  return value.trim() || null;
}

function phoneNumber(value, label) {
  const phone = requireNonEmptyString(value, label, 24);
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[0-9 ()-]+$/.test(phone) || digits.length < 7 || digits.length > 20) {
    throw new AppError(400, `${label} must contain a valid international phone number.`);
  }
  return phone;
}

function supplierInput(body, existing = {}) {
  return {
    business_name: requireNonEmptyString(body.business_name ?? existing.business_name, 'Business name', 140),
    contact_person: requireNonEmptyString(body.contact_person ?? existing.contact_person, 'Contact person', 120),
    phone: phoneNumber(body.phone ?? existing.phone, 'Supplier phone'),
    province: requireEnum(body.province ?? existing.province, PROVINCES, 'Province'),
    address: body.address === undefined ? (existing.address ?? null) : optionalText(body.address, 'Address', 255)
  };
}

function fruitInput(body, existing = {}) {
  return {
    fruit_name: requireNonEmptyString(body.fruit_name ?? existing.fruit_name, 'Fruit name', 80),
    description: body.description === undefined ? (existing.description ?? null) : optionalText(body.description, 'Description', 500),
    status: requireEnum(body.status ?? existing.status ?? 'ACTIVE', FRUIT_STATUSES, 'Fruit status')
  };
}

function vendorInput(body, existing = {}) {
  return {
    vendor_name: requireNonEmptyString(body.vendor_name ?? existing.vendor_name, 'Vendor name', 140),
    phone_number: phoneNumber(body.phone_number ?? existing.phone_number, 'Vendor phone'),
    location: body.location === undefined ? (existing.location ?? null) : optionalText(body.location, 'Location', 180)
  };
}

function packaging(value, label = 'Packaging size') {
  return requireEnum(value, PACKAGING_SIZES, label);
}

function normalizePurchaseItems(value) {
  if (!Array.isArray(value) || value.length === 0) throw new AppError(400, 'items must be a non-empty array.');
  if (value.length > 100) throw new AppError(400, 'A request may contain at most 100 items.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AppError(400, `Item ${index + 1} must be an object.`);
    return {
      fruit_id: positiveId(item.fruit_id, `Item ${index + 1} fruit_id`),
      packaging_size: packaging(item.packaging_size, `Item ${index + 1} packaging_size`),
      quantity: positiveInteger(item.quantity, `Item ${index + 1} quantity`),
      unit_cost: nonNegativeMoney(item.unit_cost, `Item ${index + 1} unit_cost`)
    };
  });
}

function normalizeSaleItems(value) {
  if (!Array.isArray(value) || value.length === 0) throw new AppError(400, 'items must be a non-empty array.');
  if (value.length > 100) throw new AppError(400, 'A request may contain at most 100 items.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new AppError(400, `Item ${index + 1} must be an object.`);
    return {
      fruit_id: positiveId(item.fruit_id, `Item ${index + 1} fruit_id`),
      packaging_size: packaging(item.packaging_size, `Item ${index + 1} packaging_size`),
      quantity: positiveInteger(item.quantity, `Item ${index + 1} quantity`)
    };
  });
}

module.exports = {
  PROVINCES, PACKAGING_SIZES, PAYMENT_METHODS, FRUIT_STATUSES,
  optionalText, phoneNumber, supplierInput, fruitInput, vendorInput,
  packaging, normalizePurchaseItems, normalizeSaleItems
};
