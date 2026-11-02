import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import ParentOrder from '../models/ParentOrder.js';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import VendorOrder from '../models/VendorOrder.js';
import { HttpError } from '../utils/httpError.js';
import { parseOrderPagination, validateIdempotencyKey, validatePlaceOrder } from '../validators/orderValidator.js';

const COMMISSION_RATE = 0.10;
const TRANSACTION_REQUIRED_MESSAGE = 'Order placement requires MongoDB transactions, but transactions are unavailable on this database deployment. No order or stock changes were committed.';

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function transactionUnsupported(error) {
  return error?.code === 20 || error?.codeName === 'IllegalOperation'
    || /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(error?.message ?? '');
}

function orderHash(input) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function orderNumber() {
  return `BRZ${Date.now().toString(36).toUpperCase()}${randomBytes(5).toString('hex').toUpperCase()}`;
}

function safeLine(line) {
  return {
    product: String(line.product),
    vendor: String(line.vendor),
    shop: String(line.shop),
    productSnapshot: line.productSnapshot,
    shopSnapshot: line.shopSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineSubtotal: line.lineSubtotal,
    commissionRate: line.commissionRate,
    commissionAmount: line.commissionAmount,
    vendorEarnings: line.vendorEarnings,
  };
}

function customerOrderView(order, vendorOrders = []) {
  return {
    id: String(order._id ?? order.id),
    orderNumber: order.orderNumber,
    customer: String(order.customer),
    customerSnapshot: order.customerSnapshot,
    deliveryAddress: order.deliveryAddress,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    items: (order.items ?? []).map(safeLine),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    commissionTotal: order.commissionTotal,
    vendorEarningsTotal: order.vendorEarningsTotal,
    vendorOrders: vendorOrders.map((vendorOrder) => ({
      id: String(vendorOrder._id ?? vendorOrder.id),
      orderNumber: vendorOrder.orderNumber,
      vendor: String(vendorOrder.vendor),
      status: vendorOrder.status,
      subtotal: vendorOrder.subtotal,
      commissionTotal: vendorOrder.commissionTotal,
      vendorEarningsTotal: vendorOrder.vendorEarningsTotal,
      items: (vendorOrder.items ?? []).map(safeLine),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function vendorOrderView(order) {
  return {
    id: String(order._id ?? order.id),
    orderNumber: order.orderNumber,
    parentOrder: String(order.parentOrder),
    customerSnapshot: order.customerSnapshot,
    deliveryAddress: order.deliveryAddress,
    shopSnapshots: order.shopSnapshots,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    items: (order.items ?? []).map(safeLine),
    subtotal: order.subtotal,
    commissionTotal: order.commissionTotal,
    vendorEarningsTotal: order.vendorEarningsTotal,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function findIdempotentOrder(customerId, key) {
  return ParentOrder.findOne({ customer: customerId, idempotencyKey: key }).select('+requestHash').lean();
}

function assertSameRequest(existing, requestHashValue) {
  if (existing.requestHash !== requestHashValue) {
    throw new HttpError(409, 'This checkout key was already used for different order details. Refresh checkout and try again.');
  }
}

async function getCreatedOrder(orderId, customerId) {
  const order = await ParentOrder.findOne({ _id: orderId, customer: customerId }).lean();
  if (!order) throw new HttpError(500, 'The order was placed but could not be loaded.');
  const vendorOrders = await VendorOrder.find({ parentOrder: order._id }).sort({ createdAt: 1, _id: 1 }).lean();
  return customerOrderView(order, vendorOrders);
}

export async function placeCustomerOrder(customerId, body, rawIdempotencyKey) {
  const input = validatePlaceOrder(body);
  const key = validateIdempotencyKey(rawIdempotencyKey);
  const fingerprint = orderHash(input);
  const priorOrder = await findIdempotentOrder(customerId, key);
  if (priorOrder) {
    assertSameRequest(priorOrder, fingerprint);
    return { order: await getCreatedOrder(priorOrder._id, customerId), replayed: true };
  }

  const session = await mongoose.startSession();
  let createdOrderId;
  try {
    await session.withTransaction(async () => {
      const existing = await ParentOrder.findOne({ customer: customerId, idempotencyKey: key })
        .select('+requestHash').session(session).lean();
      if (existing) {
        assertSameRequest(existing, fingerprint);
        createdOrderId = existing._id;
        return;
      }

      const productIds = input.items.map((item) => new mongoose.Types.ObjectId(item.productId));
      const productFilter = {
        _id: { $in: productIds },
        status: 'approved',
        isActive: { $ne: false },
        deletedAt: null,
      };
      const products = await Product.find(productFilter).session(session).lean();
      const productById = new Map(products.map((product) => [String(product._id), product]));
      if (productById.size !== input.items.length) throw new HttpError(409, 'One or more products are no longer available.');

      const shopIds = [...new Set(products.map((product) => String(product.shop)))].map((id) => new mongoose.Types.ObjectId(id));
      const shops = await Shop.find({ _id: { $in: shopIds }, status: 'approved', isActive: { $ne: false } }).session(session).lean();
      const shopById = new Map(shops.map((shop) => [String(shop._id), shop]));
      const vendorIds = [...new Set(products.map((product) => String(product.vendor)))].map((id) => new mongoose.Types.ObjectId(id));
      const vendors = await User.find({ _id: { $in: vendorIds }, role: 'vendor', isActive: true }).select('_id role isActive').session(session).lean();
      const activeVendorIds = new Set(vendors.map((vendor) => String(vendor._id)));

      const orderItems = [];
      for (const requestedItem of input.items) {
        const product = productById.get(requestedItem.productId);
        const shop = product && shopById.get(String(product.shop));
        if (!product || !shop || !activeVendorIds.has(String(product.vendor)) || String(shop.owner) !== String(product.vendor)) {
          throw new HttpError(409, 'One or more products are no longer available.');
        }
        if (!Number.isSafeInteger(product.stock) || requestedItem.quantity > product.stock) {
          throw new HttpError(409, `There is not enough stock for ${product.name}.`);
        }
        const unitPrice = roundMoney(Number(product.price));
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new HttpError(409, 'One or more products have invalid pricing.');
        const lineSubtotal = roundMoney(unitPrice * requestedItem.quantity);
        const commissionAmount = roundMoney(lineSubtotal * COMMISSION_RATE);
        orderItems.push({
          product: product._id,
          vendor: product.vendor,
          shop: shop._id,
          productSnapshot: { name: product.name, slug: product.slug, image: product.images?.[0] },
          shopSnapshot: { name: shop.shopName, slug: shop.slug },
          quantity: requestedItem.quantity,
          unitPrice,
          lineSubtotal,
          commissionRate: COMMISSION_RATE,
          commissionAmount,
          vendorEarnings: roundMoney(lineSubtotal - commissionAmount),
        });
      }

      const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.lineSubtotal, 0));
      const commissionTotal = roundMoney(orderItems.reduce((sum, item) => sum + item.commissionAmount, 0));
      const vendorEarningsTotal = roundMoney(orderItems.reduce((sum, item) => sum + item.vendorEarnings, 0));
      const parentNumber = orderNumber();
      const parentDocuments = await ParentOrder.create([{
        orderNumber: parentNumber,
        customer: customerId,
        customerSnapshot: { name: input.customerName, phone: input.phone },
        idempotencyKey: key,
        requestHash: fingerprint,
        items: orderItems,
        deliveryAddress: input.deliveryAddress,
        paymentMethod: 'COD',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotal,
        deliveryFee: 0,
        total: subtotal,
        commissionTotal,
        vendorEarningsTotal,
      }], { session });
      const parentOrder = parentDocuments[0];
      createdOrderId = parentOrder._id;

      const vendorGroups = new Map();
      for (const item of orderItems) {
        const vendorKey = String(item.vendor);
        if (!vendorGroups.has(vendorKey)) vendorGroups.set(vendorKey, []);
        vendorGroups.get(vendorKey).push(item);
      }
      const vendorDocuments = [];
      let vendorIndex = 1;
      for (const [vendorId, vendorItems] of vendorGroups) {
        const vendorSubtotal = roundMoney(vendorItems.reduce((sum, item) => sum + item.lineSubtotal, 0));
        const vendorCommission = roundMoney(vendorItems.reduce((sum, item) => sum + item.commissionAmount, 0));
        const vendorEarnings = roundMoney(vendorItems.reduce((sum, item) => sum + item.vendorEarnings, 0));
        const vendorShops = new Map(vendorItems.map((item) => [String(item.shop), {
          shop: item.shop,
          name: item.shopSnapshot.name,
          slug: item.shopSnapshot.slug,
        }]));
        vendorDocuments.push({
          orderNumber: `${parentNumber}-V${vendorIndex}`,
          parentOrder: parentOrder._id,
          customer: customerId,
          customerSnapshot: parentOrder.customerSnapshot,
          vendor: new mongoose.Types.ObjectId(vendorId),
          shopSnapshots: [...vendorShops.values()],
          items: vendorItems,
          deliveryAddress: input.deliveryAddress,
          paymentMethod: 'COD',
          paymentStatus: 'PENDING',
          status: 'PENDING',
          subtotal: vendorSubtotal,
          commissionTotal: vendorCommission,
          vendorEarningsTotal: vendorEarnings,
        });
        vendorIndex += 1;
      }
      await VendorOrder.create(vendorDocuments, { session });

      for (const requestedItem of input.items) {
        const stockUpdate = await Product.updateOne({
          _id: requestedItem.productId,
          status: 'approved',
          isActive: { $ne: false },
          deletedAt: null,
          stock: { $gte: requestedItem.quantity },
        }, { $inc: { stock: -requestedItem.quantity } }, { session });
        if (stockUpdate.matchedCount !== 1) throw new HttpError(409, 'Product stock changed while placing the order. Please review your cart.');
      }
    });
  } catch (error) {
    if (transactionUnsupported(error)) throw new HttpError(503, TRANSACTION_REQUIRED_MESSAGE, { expose: true });
    if (error?.code === 11000) {
      const concurrentOrder = await findIdempotentOrder(customerId, key);
      if (concurrentOrder) {
        assertSameRequest(concurrentOrder, fingerprint);
        return { order: await getCreatedOrder(concurrentOrder._id, customerId), replayed: true };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return { order: await getCreatedOrder(createdOrderId, customerId), replayed: false };
}

export async function listCustomerOrders(customerId, query) {
  const { page, limit } = parseOrderPagination(query);
  const filter = { customer: customerId };
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    ParentOrder.find(filter).select('-requestHash -idempotencyKey').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    ParentOrder.countDocuments(filter),
  ]);
  return { orders: orders.map((order) => customerOrderView(order)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getCustomerOrder(customerId, orderId) {
  if (!mongoose.isValidObjectId(orderId)) throw new HttpError(404, 'Order not found.');
  const order = await ParentOrder.findOne({ _id: orderId, customer: customerId }).select('-requestHash -idempotencyKey').lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  const vendorOrders = await VendorOrder.find({ parentOrder: order._id }).sort({ createdAt: 1, _id: 1 }).lean();
  return customerOrderView(order, vendorOrders);
}

export async function listVendorOrders(vendorId, query) {
  const { page, limit } = parseOrderPagination(query);
  const filter = { vendor: vendorId };
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    VendorOrder.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    VendorOrder.countDocuments(filter),
  ]);
  return { orders: orders.map(vendorOrderView), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function getVendorOrder(vendorId, orderId) {
  if (!mongoose.isValidObjectId(orderId)) throw new HttpError(404, 'Order not found.');
  const order = await VendorOrder.findOne({ _id: orderId, vendor: vendorId }).lean();
  if (!order) throw new HttpError(404, 'Order not found.');
  return vendorOrderView(order);
}
