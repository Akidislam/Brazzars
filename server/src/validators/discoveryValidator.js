import { HttpError } from '../utils/httpError.js';
import { escapeSearch, isObjectIdString, parsePagination } from './productValidator.js';

const SORTS = new Set(['newest', 'price_asc', 'price_desc', 'name_asc']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertAllowedQuery(query, allowed) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new HttpError(400, 'Query parameters are invalid.');
  if (Object.keys(query).some((key) => !allowed.has(key))) throw new HttpError(400, 'An unsupported query parameter was provided.');
}

function parsePrice(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e\+?\d+)?$/i.test(value)) {
    throw new HttpError(400, `${field} must be a non-negative number.`);
  }
  const price = Number(value);
  if (!Number.isFinite(price)) throw new HttpError(400, `${field} must be a finite number.`);
  return price;
}

export function validateSlug(slug, label = 'Slug') {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) throw new HttpError(400, `${label} is invalid.`);
  return slug;
}

export function parseDirectoryQuery(query) {
  assertAllowedQuery(query, new Set(['page', 'limit', 'search']));
  const { page, limit } = parsePagination(query);
  return { page, limit, search: escapeSearch(query.search) };
}

export function parseScopedProductQuery(query, { allowCategory = false } = {}) {
  const allowed = new Set(['page', 'limit', 'search', 'sort', 'minPrice', 'maxPrice']);
  if (allowCategory) allowed.add('category');
  assertAllowedQuery(query, allowed);
  const { page, limit } = parsePagination(query);
  const search = escapeSearch(query.search);
  const sort = query.sort ?? 'newest';
  if (!SORTS.has(sort)) throw new HttpError(400, 'Sort must be newest, price_asc, price_desc, or name_asc.');
  let category;
  if (query.category !== undefined) {
    if (typeof query.category !== 'string' || (!isObjectIdString(query.category) && !SLUG_PATTERN.test(query.category))) {
      throw new HttpError(400, 'Category filter is invalid.');
    }
    category = query.category;
  }
  const minPrice = parsePrice(query.minPrice, 'minPrice');
  const maxPrice = parsePrice(query.maxPrice, 'maxPrice');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new HttpError(400, 'minPrice cannot be greater than maxPrice.');
  }
  return { page, limit, search, sort, category, minPrice, maxPrice };
}

export function parseGlobalProductQuery(query) {
  const allowed = new Set(['page', 'limit', 'search', 'category', 'shop', 'minPrice', 'maxPrice', 'sort']);
  assertAllowedQuery(query, allowed);
  const { shop: shopQuery, ...productQuery } = query;
  const parsed = parseScopedProductQuery(productQuery, { allowCategory: true });
  let shop;
  if (shopQuery !== undefined) {
    if (typeof shopQuery !== 'string' || (!isObjectIdString(shopQuery) && !SLUG_PATTERN.test(shopQuery))) {
      throw new HttpError(400, 'Shop filter is invalid.');
    }
    shop = shopQuery;
  }
  return { ...parsed, shop };
}
