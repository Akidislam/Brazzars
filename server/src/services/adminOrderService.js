import mongoose from 'mongoose';
import ParentOrder, { ORDER_STATUSES } from '../models/ParentOrder.js';
import User from '../models/User.js';
import VendorOrder from '../models/VendorOrder.js';
import { HttpError } from '../utils/httpError.js';
import { parseAdminOrderQuery } from '../validators/orderValidator.js';
import { transitionVendorOrderStatus } from './orderStatusService.js';

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function adminLineView(line) {
  return {
    product: String(line.product), vendor: String(line.vendor), shop: String(line.shop),
    productSnapshot: line.productSnapshot, shopSnapshot: line.shopSnapshot,
    quantity: line.quantity, unitPrice: line.unitPrice, lineSubtotal: line.lineSubtotal,
    commissionRate: line.commissionRate, commissionAmount: line.commissionAmount, vendorEarnings: line.vendorEarnings,
  };
}

function statusHistoryView(entries = []) {
  return entries.map((entry) => ({
    status: entry.status,
    changedAt: entry.changedAt,
    actor: entry.actor ? String(entry.actor) : null,
    actorRole: entry.actorRole,
  }));
}

function vendorOrderView(order, vendorNames, detailed = true) {
  const vendorId = String(order.vendor);
  const base = {
    id: String(order._id ?? order.id),
    orderNumber: order.orderNumber,
    parentOrder: String(order.parentOrder),
    parentOrderNumber: order.parentOrderNumber,
    vendor: { id: vendorId, name: vendorNames.get(vendorId) ?? 'Vendor' },
    shopSnapshots: order.shopSnapshots ?? [],
    status: order.status,
    itemCount: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    subtotal: order.subtotal,
    commissionTotal: order.commissionTotal,
    vendorEarningsTotal: order.vendorEarningsTotal,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
  if (!detailed) return base;
  return {
    ...base,
    customer: { id: String(order.customer), ...order.customerSnapshot },
    deliveryAddress: order.deliveryAddress,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: (order.items ?? []).map(adminLineView),
    statusHistory: statusHistoryView(order.statusHistory),
  };
}

function parentOrderView(order, vendorOrders = [], vendorNames = new Map(), detailed = true) {
  const view = {
    id: String(order._id ?? order.id),
    orderNumber: order.orderNumber,
    customer: { id: String(order.customer), ...order.customerSnapshot },
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    itemCount: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    commissionTotal: order.commissionTotal,
    vendorEarningsTotal: order.vendorEarningsTotal,
    vendorOrders: vendorOrders.map((child) => vendorOrderView(child, vendorNames, detailed)),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
  if (!detailed) return view;
  return {
    ...view,
    deliveryAddress: order.deliveryAddress,
    items: (order.items ?? []).map(adminLineView),
    statusHistory: statusHistoryView(order.statusHistory),
  };
}

async function vendorNamesFor(orders) {
  const ids = [...new Set(orders.map((order) => String(order.vendor)))];
  if (!ids.length) return new Map();
  const vendors = await User.find({ _id: { $in: ids } }).select('_id name').lean();
  return new Map(vendors.map((vendor) => [String(vendor._id), vendor.name]));
}

export async function getAdminOrderStatistics() {
  const [statusCounts, totals] = await Promise.all([
    Promise.all([null, ...ORDER_STATUSES].map(async (status) => [
      status ?? 'ALL',
      await ParentOrder.countDocuments({ ...(status ? { status } : {}) }),
    ])),
    ParentOrder.aggregate([{ $group: { _id: null, totalOrderValue: { $sum: '$total' } } }]),
  ]);
  return { ...Object.fromEntries(statusCounts), totalOrderValue: totals[0]?.totalOrderValue ?? 0 };
}

async function matchingParentIds(search) {
  if (!search) return [];
  const pattern = { $regex: escapeRegex(search), $options: 'i' };
  const matchingVendors = await User.find({ role: 'vendor', name: pattern }).select('_id').lean();
  const vendorIds = matchingVendors.map((vendor) => vendor._id);
  const relatedFilters = [
    { orderNumber: pattern },
    { parentOrderNumber: pattern },
    { 'shopSnapshots.name': pattern },
  ];
  if (vendorIds.length) relatedFilters.push({ vendor: { $in: vendorIds } });
  const matchingVendorOrders = await VendorOrder.find({ $or: relatedFilters }).select('parentOrder').lean();
  return [...new Set(matchingVendorOrders.map((order) => String(order.parentOrder)))];
}

export async function listAdminOrders(query) {
  const { page, limit, status, search, sort, from, to } = parseAdminOrderQuery(query);
  const filter = {};
  if (status) filter.status = status;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (search) {
    const matchingIds = await matchingParentIds(search);
    const pattern = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [
      { orderNumber: pattern },
      { 'customerSnapshot.name': pattern },
      { 'customerSnapshot.phone': pattern },
      { _id: { $in: matchingIds } },
    ];
  }
  const direction = sort === 'oldest' ? 1 : -1;
  const [orders, total] = await Promise.all([
    ParentOrder.find(filter).select('-requestHash -idempotencyKey').sort({ createdAt: direction, _id: direction }).skip((page - 1) * limit).limit(limit).lean(),
    ParentOrder.countDocuments(filter),
  ]);
  const orderIds = orders.map((order) => order._id);
  const vendorOrders = orderIds.length ? await VendorOrder.find({ parentOrder: { $in: orderIds } }).sort({ createdAt: 1, _id: 1 }).lean() : [];
  const vendorNames = await vendorNamesFor(vendorOrders);
  const childrenByParent = new Map();
  for (const child of vendorOrders) {
    const key = String(child.parentOrder);
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(child);
  }
  return {
    orders: orders.map((order) => parentOrderView(order, childrenByParent.get(String(order._id)) ?? [], vendorNames, false)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getAdminOrder(orderId) {
  if (!mongoose.isValidObjectId(orderId)) throw new HttpError(404, 'Order not found.');
  const order = await ParentOrder.findById(orderId).select('-requestHash -idempotencyKey').lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  const vendorOrders = await VendorOrder.find({ parentOrder: order._id }).sort({ createdAt: 1, _id: 1 }).lean();
  const vendorNames = await vendorNamesFor(vendorOrders);
  return parentOrderView(order, vendorOrders, vendorNames, true);
}

export async function updateAdminVendorOrderStatus(adminId, orderId, body) {
  const parentOrderId = await transitionVendorOrderStatus({ orderId, actorId: adminId, actorRole: 'admin', body });
  return getAdminOrder(parentOrderId);
}
