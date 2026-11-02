import { HttpError } from '../utils/httpError.js';

const CREATE_FIELDS = new Set(['name', 'description', 'price', 'compareAtPrice', 'category', 'stock', 'imageUrl', 'images']);
const UPDATE_FIELDS = new Set(['name', 'description', 'price', 'compareAtPrice', 'category', 'stock', 'imageUrl', 'images']);
const IMMUTABLE_FIELDS = new Set([
  'vendor', 'vendorId', 'shop', 'shopId', 'status', 'isActive', 'approved', 'approvedBy', 'reviewedBy',
  'reviewedAt', 'rejectionReason', 'deletedAt', '_id', 'id', 'slug', 'createdAt', 'updatedAt', '__v',
]);
const MAX_IMAGES = 10;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'A JSON object is required.');
  }
  return body;
}

function validateFields(body, allowedFields) {
  const keys = Object.keys(body);
  if (keys.some((key) => IMMUTABLE_FIELDS.has(key))) {
    throw new HttpError(400, 'System and approval fields cannot be changed by vendors.');
  }
  if (keys.some((key) => !allowedFields.has(key))) {
    throw new HttpError(400, 'The request contains unsupported product fields.');
  }
}

function normalizeText(value, field, { required = false, max = 10000 } = {}) {
  if (value === undefined) {
    if (required) throw new HttpError(400, `${field} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`);
  const normalized = value.trim();
  if (required && !normalized) throw new HttpError(400, `${field} is required.`);
  if (normalized.length > max) throw new HttpError(400, `${field} must be no more than ${max} characters.`);
  return normalized;
}

function normalizeNumber(value, field, { required = false, minimum = 0, integer = false } = {}) {
  if (value === undefined) {
    if (required) throw new HttpError(400, `${field} is required.`);
    return undefined;
  }
  if (value === null || value === '' || typeof value === 'boolean') throw new HttpError(400, `${field} is invalid.`);
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    throw new HttpError(400, `${field} is invalid.`);
  }
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(normalized) || normalized < minimum || (integer && !Number.isInteger(normalized))) {
    throw new HttpError(400, `${field} is invalid.`);
  }
  return normalized;
}

function normalizeCategory(value, required = false) {
  if (value === undefined) {
    if (required) throw new HttpError(400, 'Category is required.');
    return undefined;
  }
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw new HttpError(400, 'Category must be a valid category ID.');
  }
  return value;
}

function normalizeImage(value) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 2048) {
    throw new HttpError(400, 'Each product image must be a valid HTTP or HTTPS URL.');
  }
  let parsed;
  try { parsed = new URL(value.trim()); } catch { throw new HttpError(400, 'Each product image must be a valid HTTP or HTTPS URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new HttpError(400, 'Each product image must be a valid HTTP or HTTPS URL.');
  }
  return parsed.toString();
}

function normalizeImages(body) {
  if (body.images !== undefined && !Array.isArray(body.images)) {
    throw new HttpError(400, 'Images must be an array of image URLs.');
  }
  const values = [...(body.images ?? [])];
  if (body.imageUrl !== undefined) values.unshift(body.imageUrl);
  if (values.length > MAX_IMAGES) throw new HttpError(400, `A product can have no more than ${MAX_IMAGES} images.`);
  return values.map(normalizeImage);
}

export function validateCreateProduct(body) {
  const input = requireObject(body);
  validateFields(input, CREATE_FIELDS);
  const product = {
    name: normalizeText(input.name, 'Product name', { required: true, max: 180 }),
    description: normalizeText(input.description, 'Description', { required: true, max: 10000 }),
    price: normalizeNumber(input.price, 'Price', { required: true, minimum: Number.MIN_VALUE }),
    category: normalizeCategory(input.category, true),
    stock: normalizeNumber(input.stock, 'Stock', { required: true, integer: true }),
    images: normalizeImages(input),
  };
  const compareAtPrice = normalizeNumber(input.compareAtPrice, 'Compare-at price');
  if (compareAtPrice !== undefined) product.compareAtPrice = compareAtPrice;
  return product;
}

export function validateProductUpdate(body) {
  const input = requireObject(body);
  validateFields(input, UPDATE_FIELDS);
  if (Object.keys(input).length === 0) throw new HttpError(400, 'At least one product field must be provided.');
  const product = {};
  if ('name' in input) product.name = normalizeText(input.name, 'Product name', { required: true, max: 180 });
  if ('description' in input) product.description = normalizeText(input.description, 'Description', { required: true, max: 10000 });
  if ('price' in input) product.price = normalizeNumber(input.price, 'Price', { required: true, minimum: Number.MIN_VALUE });
  if ('compareAtPrice' in input) product.compareAtPrice = normalizeNumber(input.compareAtPrice, 'Compare-at price');
  if ('category' in input) product.category = normalizeCategory(input.category, true);
  if ('stock' in input) product.stock = normalizeNumber(input.stock, 'Stock', { required: true, integer: true });
  if ('images' in input || 'imageUrl' in input) product.images = normalizeImages(input);
  return product;
}

export function validateObjectId(value, label = 'Product ID') {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) throw new HttpError(400, `${label} is invalid.`);
  return value;
}

export function isObjectIdString(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

export function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const maxPage = 1_000_000;
  const parse = (value, fallback, name, max = Number.MAX_SAFE_INTEGER) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpError(400, `${name} must be a positive integer.`);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new HttpError(400, `${name} is out of range.`);
    return number;
  };
  return {
    page: parse(query.page, 1, 'Page', maxPage),
    limit: parse(query.limit, defaultLimit, 'Limit', maxLimit),
  };
}

export function escapeSearch(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 100) throw new HttpError(400, 'Search must be 100 characters or fewer.');
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : undefined;
}

export function parseBooleanFilter(value, name) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new HttpError(400, `${name} must be true or false.`);
}
