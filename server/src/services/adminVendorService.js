import mongoose from 'mongoose';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { escapeSearch } from '../validators/productValidator.js';

const ID_PATTERN = /^[a-f\d]{24}$/i;
const VENDOR_STATUSES = new Set(['pending', 'approved', 'rejected', 'suspended']);

function parseVendorQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) throw new HttpError(400, 'Vendor filters are invalid.');
  const allowed = new Set(['page', 'limit', 'search', 'status', 'active', 'sort']);
  if (Object.keys(query).some((key) => !allowed.has(key))) throw new HttpError(400, 'An unsupported vendor filter was provided.');
  const parseInteger = (value, fallback, max, field) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpError(400, `${field} must be a positive integer.`);
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new HttpError(400, `${field} is out of range.`);
    return number;
  };
  const page = parseInteger(query.page, 1, 1000000, 'Page');
  const limit = parseInteger(query.limit, 10, 100, 'Limit');
  const search = escapeSearch(query.search);
  const status = query.status && query.status !== 'all' ? query.status : undefined;
  if (status && !VENDOR_STATUSES.has(status)) throw new HttpError(400, 'Vendor status filter is invalid.');
  let active;
  if (query.active !== undefined) {
    if (query.active === 'true') active = true;
    else if (query.active === 'false') active = false;
    else throw new HttpError(400, 'Active filter must be true or false.');
  }
  const sort = query.sort ?? 'newest';
  if (!['newest', 'oldest'].includes(sort)) throw new HttpError(400, 'Sort must be newest or oldest.');
  return { page, limit, search, status, active, sort };
}

function assertVendorId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id) || !mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'Vendor ID is invalid.');
  }
}

function shopFilterFor({ status, active }) {
  const filter = {};
  if (status) filter.status = status;
  if (active === true) filter.isActive = { $ne: false };
  if (active === false) filter.isActive = false;
  return filter;
}

function vendorView(vendor, shop) {
  return {
    id: String(vendor._id ?? vendor.id),
    name: vendor.name,
    email: vendor.email,
    ...(vendor.phone ? { phone: vendor.phone } : {}),
    isActive: vendor.isActive !== false,
    createdAt: vendor.createdAt,
    shop: shop ? {
      id: String(shop._id ?? shop.id),
      shopName: shop.shopName,
      slug: shop.slug,
      description: shop.description ?? '',
      logo: shop.logo ?? '',
      contactEmail: shop.contactEmail ?? '',
      contactPhone: shop.contactPhone ?? '',
      address: shop.address ?? null,
      status: shop.status ?? 'pending',
      isActive: shop.isActive !== false,
      reviewedAt: shop.reviewedAt ?? null,
      rejectionReason: shop.rejectionReason ?? null,
      createdAt: shop.createdAt,
    } : null,
  };
}

export async function getAdminVendorStatistics() {
  const [totalVendors, pendingApproval, approvedVendors, rejectedVendors, activeShops, inactiveShops] = await Promise.all([
    User.countDocuments({ role: 'vendor' }),
    Shop.countDocuments({ status: 'pending' }),
    Shop.countDocuments({ status: 'approved' }),
    Shop.countDocuments({ status: 'rejected' }),
    Shop.countDocuments({ isActive: { $ne: false } }),
    Shop.countDocuments({ isActive: false }),
  ]);
  return { totalVendors, pendingApproval, approvedVendors, rejectedVendors, activeShops, inactiveShops };
}

export async function listAdminVendors(query) {
  const filters = parseVendorQuery(query);
  const shopFilter = shopFilterFor(filters);
  const hasShopFilters = Boolean(filters.status || filters.active !== undefined);
  let filteredShopOwners;
  if (hasShopFilters) filteredShopOwners = await Shop.distinct('owner', shopFilter);

  const userFilter = { role: 'vendor' };
  if (hasShopFilters) {
    if (!filteredShopOwners.length) {
      const statistics = await getAdminVendorStatistics();
      return { vendors: [], pagination: { page: filters.page, limit: filters.limit, total: 0, pages: 0 }, statistics };
    }
    userFilter._id = { $in: filteredShopOwners };
  }

  if (filters.search) {
    const expression = { $regex: filters.search, $options: 'i' };
    const shopOwners = await Shop.distinct('owner', { shopName: expression });
    userFilter.$or = [
      { name: expression },
      { email: expression },
      { phone: expression },
      { _id: { $in: shopOwners } },
    ];
  }

  const direction = filters.sort === 'oldest' ? 1 : -1;
  const [vendors, total, statistics] = await Promise.all([
    User.find(userFilter).select('name email phone isActive createdAt').sort({ createdAt: direction, _id: direction }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    User.countDocuments(userFilter),
    getAdminVendorStatistics(),
  ]);

  const vendorIds = vendors.map((vendor) => vendor._id);
  const shops = vendorIds.length
    ? await Shop.find({ owner: { $in: vendorIds }, ...(hasShopFilters ? shopFilter : {}) }).sort({ createdAt: -1, _id: -1 }).lean()
    : [];
  const shopByOwner = new Map();
  for (const shop of shops) {
    const owner = String(shop.owner);
    if (!shopByOwner.has(owner)) shopByOwner.set(owner, shop);
  }

  return {
    vendors: vendors.map((vendor) => vendorView(vendor, shopByOwner.get(String(vendor._id)) ?? null)),
    pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) },
    statistics,
  };
}

async function getVendorAndShop(id) {
  assertVendorId(id);
  const vendor = await User.findOne({ _id: id, role: 'vendor' }).select('name email phone isActive createdAt').lean();
  if (!vendor) throw new HttpError(404, 'Vendor not found.');
  const shop = await Shop.findOne({ owner: vendor._id }).sort({ createdAt: -1, _id: -1 }).lean();
  return { vendor, shop };
}

export async function getAdminVendor(id) {
  const { vendor, shop } = await getVendorAndShop(id);
  return vendorView(vendor, shop);
}

export async function approveAdminVendor(id, adminId) {
  const { vendor, shop } = await getVendorAndShop(id);
  if (!shop) throw new HttpError(404, 'Vendor shop not found.');
  if (!['pending', 'rejected'].includes(shop.status)) throw new HttpError(409, 'Only pending or rejected vendor shops can be approved.');
  shop.status = 'approved';
  shop.reviewedBy = adminId;
  shop.reviewedAt = new Date();
  shop.rejectionReason = null;
  await shop.save();
  return vendorView(vendor, shop);
}

export async function rejectAdminVendor(id, adminId, body) {
  const { vendor, shop } = await getVendorAndShop(id);
  if (!shop) throw new HttpError(404, 'Vendor shop not found.');
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'reason')) {
    throw new HttpError(400, 'A rejection reason is required.');
  }
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 500) throw new HttpError(400, 'Rejection reason must be between 5 and 500 characters.');
  if (shop.status !== 'pending') throw new HttpError(409, 'Only pending vendor shops can be rejected.');
  shop.status = 'rejected';
  shop.reviewedBy = adminId;
  shop.reviewedAt = new Date();
  shop.rejectionReason = reason;
  await shop.save();
  return vendorView(vendor, shop);
}

export async function setAdminVendorShopActive(id, isActive) {
  if (typeof isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
  const { vendor, shop } = await getVendorAndShop(id);
  if (!shop) throw new HttpError(404, 'Vendor shop not found.');
  if (shop.status !== 'approved') throw new HttpError(409, 'Only approved vendor shops can be activated or deactivated.');
  shop.isActive = isActive;
  await shop.save();
  return vendorView(vendor, shop);
}
