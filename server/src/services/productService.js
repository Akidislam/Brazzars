import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';
import { HttpError } from '../utils/httpError.js';
import {
  escapeSearch,
  isObjectIdString,
  parseBooleanFilter,
  parsePagination,
  validateCreateProduct,
  validateObjectId,
  validateProductUpdate,
} from '../validators/productValidator.js';
import { parseGlobalProductQuery } from '../validators/discoveryValidator.js';

const CATEGORY_FIELDS = 'name slug image';
const SHOP_FIELDS = 'shopName slug logo status';
const PUBLIC_PRODUCT_FIELDS = '_id shop category name slug description price compareAtPrice stock images createdAt updatedAt';

function slugBase(name) {
  const base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150).replace(/-+$/g, '');
  return base || 'product';
}

async function uniqueProductSlug(shopId, name, currentProductId) {
  const base = slugBase(name);
  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const filter = { shop: shopId, slug: candidate };
    if (currentProductId) filter._id = { $ne: currentProductId };
    if (!(await Product.exists(filter))) return candidate;
  }
  throw new HttpError(409, 'Unable to create a unique product slug.');
}

function validationError(error) {
  if (error instanceof mongoose.Error.ValidationError || error?.name === 'CastError') {
    throw new HttpError(400, 'Product details are invalid.');
  }
  if (error?.code === 11000) throw new HttpError(409, 'A product with that slug already exists in your shop.');
  throw error;
}

function productView(product) {
  if (!product) return null;
  const value = typeof product.toObject === 'function' ? product.toObject() : product;
  const related = (field, keys) => {
    const item = value[field];
    if (!item || typeof item !== 'object') return item == null ? null : String(item);
    if (mongoose.isValidObjectId(item)) return String(item);
    const safe = { id: String(item._id ?? item.id) };
    for (const key of keys) if (item[key] !== undefined) safe[key] = item[key];
    return safe;
  };
  return {
    id: String(value._id ?? value.id),
    vendor: value.vendor && typeof value.vendor === 'object' && !mongoose.isValidObjectId(value.vendor)
      ? { id: String(value.vendor._id ?? value.vendor.id), name: value.vendor.name, email: value.vendor.email }
      : (value.vendor == null ? null : String(value.vendor)),
    shop: related('shop', ['shopName', 'slug', 'logo', 'status']),
    category: related('category', ['name', 'slug', 'image']),
    name: value.name,
    slug: value.slug,
    description: value.description,
    price: value.price,
    compareAtPrice: value.compareAtPrice,
    stock: value.stock,
    images: value.images,
    status: value.status,
    isActive: value.isActive,
    deletedAt: value.deletedAt,
    reviewedBy: value.reviewedBy == null ? null : String(value.reviewedBy?._id ?? value.reviewedBy),
    reviewedAt: value.reviewedAt,
    rejectionReason: value.rejectionReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function vendorListView(product) {
  const view = productView(product);
  if (view && view.vendor && typeof view.vendor === 'object') view.vendor = view.vendor.id;
  return view;
}

function paginationView(page, limit, total) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}

async function getPublicShopIds() {
  const shops = await Shop.find({ status: 'approved', isActive: { $ne: false } }).select('_id').lean();
  return shops.map((shop) => shop._id);
}

async function requireVendorShop(vendorId) {
  const shop = await Shop.findOne({ owner: vendorId });
  if (!shop) throw new HttpError(404, 'A shop must exist before you can manage products.');
  return shop;
}

async function requireActiveCategory(categoryId) {
  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw new HttpError(400, 'Select an active product category.');
  return category;
}

async function loadVendorProduct(vendorId, productId) {
  validateObjectId(productId);
  const product = await Product.findOne({ _id: productId, vendor: vendorId, deletedAt: null })
    .populate('category', CATEGORY_FIELDS)
    .populate('shop', SHOP_FIELDS);
  if (!product) throw new HttpError(404, 'Product not found.');
  return product;
}

export async function createVendorProduct(vendorId, body) {
  const input = validateCreateProduct(body);
  const shop = await requireVendorShop(vendorId);
  await requireActiveCategory(input.category);
  const slug = await uniqueProductSlug(shop._id, input.name);
  try {
    const product = new Product({ ...input, vendor: vendorId, shop: shop._id, slug, status: 'pending', isActive: true });
    await product.save();
    return vendorListView(product);
  } catch (error) {
    validationError(error);
  }
}

export async function listVendorProducts(vendorId, query) {
  const { page, limit } = parsePagination(query);
  const search = escapeSearch(query.search);
  const status = query.status;
  if (status !== undefined && !['pending', 'approved', 'rejected', 'disabled'].includes(status)) {
    throw new HttpError(400, 'Status filter is invalid.');
  }
  const isActive = parseBooleanFilter(query.isActive, 'isActive');
  const filter = { vendor: vendorId, deletedAt: null };
  if (status) filter.status = status;
  if (isActive === true) filter.isActive = { $ne: false };
  else if (isActive === false) filter.isActive = false;
  if (search) filter.name = { $regex: search, $options: 'i' };
  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', CATEGORY_FIELDS).populate('shop', SHOP_FIELDS)
      .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { products: products.map(vendorListView), pagination: paginationView(page, limit, total) };
}

export async function getVendorProduct(vendorId, productId) {
  const product = await loadVendorProduct(vendorId, productId);
  return vendorListView(product);
}

export async function updateVendorProduct(vendorId, productId, body) {
  const changes = validateProductUpdate(body);
  const product = await loadVendorProduct(vendorId, productId);
  if (changes.category) await requireActiveCategory(changes.category);

  const significantFields = ['name', 'description', 'price', 'compareAtPrice', 'category', 'images'];
  const changedSignificantly = significantFields.some((field) => {
    if (!(field in changes)) return false;
    if (field === 'images') return JSON.stringify(product.images ?? []) !== JSON.stringify(changes.images);
    if (field === 'category') return String(product.category?._id ?? product.category) !== String(changes.category);
    return product[field] !== changes[field];
  });

  try {
    Object.assign(product, changes);
    if (changes.name) product.slug = await uniqueProductSlug(product.shop?._id ?? product.shop, changes.name, product._id);
    if (changedSignificantly) {
      product.status = 'pending';
      product.reviewedBy = null;
      product.reviewedAt = null;
      product.rejectionReason = null;
    }
    await product.save();
    return vendorListView(product);
  } catch (error) {
    validationError(error);
  }
}

export async function deleteVendorProduct(vendorId, productId) {
  const product = await loadVendorProduct(vendorId, productId);
  product.isActive = false;
  product.deletedAt = new Date();
  try {
    await product.save();
  } catch (error) {
    validationError(error);
  }
  return { id: String(product._id), deleted: true };
}

export async function listPendingProducts(query) {
  const { page, limit } = parsePagination(query);
  const filter = { status: 'pending', isActive: { $ne: false }, deletedAt: null };
  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(filter).populate('vendor', 'name email').populate('shop', SHOP_FIELDS)
      .populate('category', CATEGORY_FIELDS).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { products: products.map(productView), pagination: paginationView(page, limit, total) };
}

async function reviewProduct(adminId, productId, status, reason = null) {
  validateObjectId(productId);
  const product = await Product.findOne({ _id: productId, status: 'pending', isActive: { $ne: false }, deletedAt: null });
  if (!product) {
    const existing = await Product.exists({ _id: productId, deletedAt: null });
    if (!existing) throw new HttpError(404, 'Product not found.');
    throw new HttpError(409, 'Only pending active products can be reviewed.');
  }
  product.status = status;
  product.reviewedBy = adminId;
  product.reviewedAt = new Date();
  product.rejectionReason = status === 'rejected' ? reason : null;
  try {
    await product.save();
  } catch (error) {
    validationError(error);
  }
  return productView(product);
}

export async function approveProduct(adminId, productId) {
  return reviewProduct(adminId, productId, 'approved');
}

export async function rejectProduct(adminId, productId, body) {
  const input = body === undefined ? {} : body;
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => key !== 'reason')) {
    throw new HttpError(400, 'Only an optional rejection reason is allowed.');
  }
  let reason = null;
  if (input.reason !== undefined) {
    if (typeof input.reason !== 'string' || input.reason.trim().length > 500) {
      throw new HttpError(400, 'Rejection reason must be 500 characters or fewer.');
    }
    reason = input.reason.trim() || null;
  }
  return reviewProduct(adminId, productId, 'rejected', reason);
}

function publicSort(sort) {
  const sorts = {
    newest: { createdAt: -1, _id: -1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: -1 },
    name_asc: { name: 1, _id: 1 },
  };
  if (sort === undefined) return sorts.newest;
  if (!sorts[sort]) throw new HttpError(400, 'Sort must be newest, price_asc, price_desc, or name_asc.');
  return sorts[sort];
}

export async function listPublicProducts(query) {
  const { page, limit, search, sort: requestedSort, category: categoryValue, shop: shopValue, minPrice, maxPrice } = parseGlobalProductQuery(query);
  const sort = publicSort(requestedSort);
  // Older Product documents predate isActive/deletedAt. Treat the missing active marker as true;
  // `deletedAt: null` also matches documents without that field in MongoDB.
  const filter = { status: 'approved', isActive: { $ne: false }, deletedAt: null };
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
    };
  }
  if (categoryValue !== undefined) {
    const categoryKey = isObjectIdString(categoryValue) ? { _id: categoryValue } : { slug: categoryValue };
    const category = await Category.findOne({ ...categoryKey, isActive: true }).select('_id').lean();
    if (!category) return { products: [], pagination: paginationView(page, limit, 0) };
    filter.category = category._id;
  }
  if (shopValue !== undefined) {
    const shopKey = isObjectIdString(shopValue) ? { _id: shopValue } : { slug: shopValue };
    const shop = await Shop.findOne({ ...shopKey, status: 'approved', isActive: { $ne: false } }).select('_id').lean();
    if (!shop) return { products: [], pagination: paginationView(page, limit, 0) };
    filter.shop = shop._id;
  } else {
    const publicShopIds = await getPublicShopIds();
    if (publicShopIds.length === 0) return { products: [], pagination: paginationView(page, limit, 0) };
    filter.shop = { $in: publicShopIds };
  }
  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(filter).select(PUBLIC_PRODUCT_FIELDS)
      .populate('shop', 'shopName slug logo').populate('category', CATEGORY_FIELDS)
      .sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  return { products: products.map((product) => {
    const view = productView(product);
    delete view.vendor;
    delete view.deletedAt;
    delete view.reviewedBy;
    delete view.reviewedAt;
    delete view.rejectionReason;
    return view;
  }), pagination: paginationView(page, limit, total) };
}

export async function getPublicProductBySlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(404, 'Product not found.');
  const publicShopIds = await getPublicShopIds();
  if (publicShopIds.length === 0) throw new HttpError(404, 'Product not found.');
  const product = await Product.findOne({
    slug, status: 'approved', isActive: { $ne: false }, deletedAt: null, shop: { $in: publicShopIds },
  }).select(PUBLIC_PRODUCT_FIELDS).populate('shop', 'shopName slug logo').populate('category', CATEGORY_FIELDS).lean();
  if (!product) throw new HttpError(404, 'Product not found.');
  const view = productView(product);
  delete view.vendor;
  delete view.deletedAt;
  delete view.reviewedBy;
  delete view.reviewedAt;
  delete view.rejectionReason;
  return view;
}
