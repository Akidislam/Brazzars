import Category from '../models/Category.js';
import Shop from '../models/Shop.js';
import { HttpError } from '../utils/httpError.js';
import { listPublicProducts } from './productService.js';
import {
  parseDirectoryQuery,
  parseScopedProductQuery,
  validateSlug,
} from '../validators/discoveryValidator.js';

const CATEGORY_PUBLIC_FIELDS = '_id name slug description image createdAt updatedAt';
const SHOP_PUBLIC_FIELDS = 'shopName slug logo description address';
const PUBLIC_SHOP_FILTER = { status: 'approved', isActive: { $ne: false } };

function pagination(page, limit, total) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}

function categoryView(category) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    ...(category.description !== undefined ? { description: category.description } : {}),
    ...(category.image !== undefined ? { image: category.image } : {}),
  };
}

function publicAddress(address) {
  if (!address) return undefined;
  const location = {};
  for (const field of ['city', 'district', 'country']) {
    if (address[field]) location[field] = address[field];
  }
  return Object.keys(location).length > 0 ? location : undefined;
}

function shopView(shop) {
  const address = publicAddress(shop.address);
  return {
    shopName: shop.shopName,
    slug: shop.slug,
    ...(shop.logo ? { logo: shop.logo } : {}),
    ...(shop.description ? { description: shop.description } : {}),
    ...(address ? { address } : {}),
  };
}

export async function listPublicCategories(query) {
  const { page, limit, search } = parseDirectoryQuery(query);
  const filter = { isActive: true };
  if (search) filter.name = { $regex: search, $options: 'i' };
  const skip = (page - 1) * limit;
  const [categories, total] = await Promise.all([
    Category.find(filter).select(CATEGORY_PUBLIC_FIELDS).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);
  return { categories: categories.map(categoryView), pagination: pagination(page, limit, total) };
}

export async function getPublicCategoryBySlug(slug) {
  validateSlug(slug, 'Category slug');
  const category = await Category.findOne({ slug, isActive: true }).select(CATEGORY_PUBLIC_FIELDS).lean();
  if (!category) throw new HttpError(404, 'Category not found.');
  return categoryView(category);
}

export async function listCategoryProducts(slug, query) {
  validateSlug(slug, 'Category slug');
  parseScopedProductQuery(query);
  const category = await Category.findOne({ slug, isActive: true }).select('_id').lean();
  if (!category) throw new HttpError(404, 'Category not found.');
  return listPublicProducts({ ...query, category: String(category._id) });
}

export async function listPublicShops(query) {
  const { page, limit, search } = parseDirectoryQuery(query);
  const filter = { ...PUBLIC_SHOP_FILTER };
  if (search) filter.shopName = { $regex: search, $options: 'i' };
  const skip = (page - 1) * limit;
  const [shops, total] = await Promise.all([
    Shop.find(filter).select(SHOP_PUBLIC_FIELDS).sort({ shopName: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    Shop.countDocuments(filter),
  ]);
  return { shops: shops.map(shopView), pagination: pagination(page, limit, total) };
}

export async function getPublicShopBySlug(slug) {
  validateSlug(slug, 'Shop slug');
  const shop = await Shop.findOne({ ...PUBLIC_SHOP_FILTER, slug }).select(SHOP_PUBLIC_FIELDS).lean();
  if (!shop) throw new HttpError(404, 'Shop not found.');
  return shopView(shop);
}

export async function listShopProducts(slug, query) {
  validateSlug(slug, 'Shop slug');
  parseScopedProductQuery(query, { allowCategory: true });
  const shop = await Shop.findOne({ ...PUBLIC_SHOP_FILTER, slug }).select('_id').lean();
  if (!shop) throw new HttpError(404, 'Shop not found.');
  return listPublicProducts({ ...query, shop: String(shop._id) });
}
