import { HttpError } from '../utils/httpError.js';

const ID_PATTERN = /^[a-f\d]{24}$/i;
const PHONE_PATTERN = /^[+\d][\d\s().-]{5,29}$/;
const ORDER_KEYS = new Set(['customerName', 'phone', 'deliveryAddress', 'paymentMethod', 'items']);
const ADDRESS_KEYS = new Set(['line1', 'line2', 'city', 'district', 'postalCode', 'instructions']);
const ITEM_KEYS = new Set(['productId', 'quantity']);

function rejectUnknownKeys(value, allowed, label) {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new HttpError(400, `${label} contains unsupported fields.`);
}

function requiredText(value, label, maxLength, minLength = 1) {
  if (typeof value !== 'string') throw new HttpError(400, `${label} is required.`);
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new HttpError(400, `${label} must be between ${minLength} and ${maxLength} characters.`);
  }
  return normalized;
}

export function validatePlaceOrder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Order details are invalid.');
  rejectUnknownKeys(body, ORDER_KEYS, 'Order details');
  const customerName = requiredText(body.customerName, 'Customer name', 120);
  const phone = requiredText(body.phone, 'Phone number', 30);
  if (!PHONE_PATTERN.test(phone)) throw new HttpError(400, 'Enter a valid phone number.');
  if (body.paymentMethod !== 'COD') throw new HttpError(400, 'Cash on Delivery is the only supported payment method.');

  const inputAddress = body.deliveryAddress;
  if (!inputAddress || typeof inputAddress !== 'object' || Array.isArray(inputAddress)) throw new HttpError(400, 'Delivery address is required.');
  rejectUnknownKeys(inputAddress, ADDRESS_KEYS, 'Delivery address');
  const deliveryAddress = {
    line1: requiredText(inputAddress.line1, 'Address line', 180, 5),
    city: requiredText(inputAddress.city, 'City or area', 100),
    district: requiredText(inputAddress.district, 'District', 100),
    country: 'Bangladesh',
  };
  for (const [inputKey, outputKey, maxLength] of [['line2', 'line2', 180], ['postalCode', 'postalCode', 20], ['instructions', 'instructions', 500]]) {
    if (inputAddress[inputKey] !== undefined && inputAddress[inputKey] !== '') {
      deliveryAddress[outputKey] = requiredText(inputAddress[inputKey], inputKey, maxLength);
    }
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    throw new HttpError(400, 'An order must contain between 1 and 50 products.');
  }
  const seenProductIds = new Set();
  const items = body.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'Order item is invalid.');
    rejectUnknownKeys(item, ITEM_KEYS, 'Order item');
    if (typeof item.productId !== 'string' || !ID_PATTERN.test(item.productId)) throw new HttpError(400, 'A product ID is invalid.');
    const productId = item.productId.toLowerCase();
    if (seenProductIds.has(productId)) throw new HttpError(400, 'Each product can only appear once in the order.');
    seenProductIds.add(productId);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) {
      throw new HttpError(400, 'Product quantity must be a positive whole number.');
    }
    return { productId, quantity: item.quantity };
  });

  return { customerName, phone, deliveryAddress, paymentMethod: 'COD', items };
}

export function validateIdempotencyKey(value) {
  if (typeof value !== 'string' || value.length < 16 || value.length > 120 || !/^[a-z\d-]+$/i.test(value)) {
    throw new HttpError(400, 'A valid Idempotency-Key header is required.');
  }
  return value;
}

export function parseOrderPagination(query) {
  const parse = (value, fallback, label, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpError(400, `${label} must be a positive integer.`);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new HttpError(400, `${label} is out of range.`);
    return number;
  };
  if (Object.keys(query).some((key) => !['page', 'limit'].includes(key))) throw new HttpError(400, 'An unsupported query parameter was provided.');
  return { page: parse(query.page, 1, 'Page', 1000000), limit: parse(query.limit, 20, 'Limit', 100) };
}

const VENDOR_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export function parseVendorOrderQuery(query) {
  if (Object.keys(query).some((key) => !['page', 'limit', 'status', 'search', 'sort'].includes(key))) {
    throw new HttpError(400, 'An unsupported query parameter was provided.');
  }
  const { page, limit } = parseOrderPagination({ page: query.page, limit: query.limit });
  let status;
  if (query.status !== undefined && query.status !== 'ALL') {
    if (!VENDOR_ORDER_STATUSES.includes(query.status)) throw new HttpError(400, 'Order status filter is invalid.');
    status = query.status;
  }
  let search;
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.trim().length > 100) throw new HttpError(400, 'Order search must be 100 characters or fewer.');
    search = query.search.trim();
  }
  const sort = query.sort ?? 'newest';
  if (!['newest', 'oldest'].includes(sort)) throw new HttpError(400, 'Order sort is invalid.');
  return { page, limit, status, search, sort };
}

export function validateVendorOrderStatus(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !VENDOR_ORDER_STATUSES.includes(body.status)) {
    throw new HttpError(400, 'A valid order status is required.');
  }
  return body.status;
}

export function parseAdminOrderQuery(query) {
  if (Object.keys(query).some((key) => !['page', 'limit', 'status', 'search', 'sort', 'from', 'to'].includes(key))) {
    throw new HttpError(400, 'An unsupported query parameter was provided.');
  }
  const { page, limit } = parseOrderPagination({ page: query.page, limit: query.limit });
  let status;
  if (query.status !== undefined && query.status !== 'ALL') {
    if (!VENDOR_ORDER_STATUSES.includes(query.status)) throw new HttpError(400, 'Order status filter is invalid.');
    status = query.status;
  }
  let search;
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.trim().length > 100) throw new HttpError(400, 'Order search must be 100 characters or fewer.');
    search = query.search.trim();
  }
  const sort = query.sort ?? 'newest';
  if (!['newest', 'oldest'].includes(sort)) throw new HttpError(400, 'Order sort is invalid.');
  const parseDate = (value, field, endOfDay = false) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, `${field} must use YYYY-MM-DD format.`);
    const result = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) throw new HttpError(400, `${field} is not a valid date.`);
    return result;
  };
  const from = parseDate(query.from, 'Start date');
  const to = parseDate(query.to, 'End date', true);
  if (from && to && from > to) throw new HttpError(400, 'Start date must not be after end date.');
  return { page, limit, status, search, sort, from, to };
}
