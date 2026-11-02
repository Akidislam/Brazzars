import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import ParentOrder from '../src/models/ParentOrder.js';
import Product from '../src/models/Product.js';
import Shop from '../src/models/Shop.js';
import User from '../src/models/User.js';
import VendorOrder from '../src/models/VendorOrder.js';
import { createAccessToken } from '../src/services/tokenService.js';

const ids = {
  customer: new mongoose.Types.ObjectId(),
  otherCustomer: new mongoose.Types.ObjectId(),
  vendorOne: new mongoose.Types.ObjectId(),
  vendorTwo: new mongoose.Types.ObjectId(),
  admin: new mongoose.Types.ObjectId(),
  shopOne: new mongoose.Types.ObjectId(),
  shopTwo: new mongoose.Types.ObjectId(),
  productOne: new mongoose.Types.ObjectId(),
  productTwo: new mongoose.Types.ObjectId(),
  inactiveProduct: new mongoose.Types.ObjectId(),
  pendingProduct: new mongoose.Types.ObjectId(),
};
const state = { users: [], shops: [], products: [], parentOrders: [], vendorOrders: [], transactionsSupported: true, failProductId: null };
let originalJwtSecret;

function same(left, right) { return String(left?._id ?? left) === String(right?._id ?? right); }

function fieldValue(record, path) {
  return path.split('.').reduce((value, part) => Array.isArray(value)
    ? value.map((entry) => entry?.[part])
    : value?.[part], record);
}

function matches(record, filter) {
  if (filter.$or && !filter.$or.some((condition) => matches(record, condition))) return false;
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return true;
    const actual = fieldValue(record, key);
    if (expected && typeof expected === 'object' && '$regex' in expected) {
      const regex = new RegExp(expected.$regex, expected.$options);
      return Array.isArray(actual) ? actual.flat(Infinity).some((value) => regex.test(value ?? '')) : regex.test(actual ?? '');
    }
    if (expected === null) return actual == null;
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.some((value) => same(actual, value));
    if (expected && typeof expected === 'object' && '$ne' in expected) return !same(actual, expected.$ne);
    if (expected && typeof expected === 'object' && '$gte' in expected && new Date(actual) < expected.$gte) return false;
    if (expected && typeof expected === 'object' && '$lte' in expected && new Date(actual) > expected.$lte) return false;
    if (expected && typeof expected === 'object' && ('$gte' in expected || '$lte' in expected)) return actual != null;
    return same(actual, expected);
  });
}

function memoryQuery(factory) {
  const options = { skip: 0, limit: Number.MAX_SAFE_INTEGER, sort: null };
  return {
    select() { return this; },
    session() { return this; },
    lean() { return this; },
    sort(value) { options.sort = value; return this; },
    skip(value) { options.skip = value; return this; },
    limit(value) { options.limit = value; return this; },
    then(resolve, reject) { return Promise.resolve().then(() => factory(options)).then(resolve, reject); },
    catch(reject) { return Promise.resolve().then(() => factory(options)).catch(reject); },
  };
}

function sortAndPage(records, options) {
  const sorted = [...records];
  if (options.sort) {
    const [[field, direction]] = Object.entries(options.sort);
    sorted.sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * direction);
  }
  return sorted.slice(options.skip, options.skip + options.limit);
}

function seed() {
  state.users = [
    { _id: ids.customer, name: 'Customer One', role: 'customer', isActive: true },
    { _id: ids.otherCustomer, name: 'Other Customer', role: 'customer', isActive: true },
    { _id: ids.vendorOne, name: 'Vendor One', role: 'vendor', isActive: true },
    { _id: ids.vendorTwo, name: 'Vendor Two', role: 'vendor', isActive: true },
    { _id: ids.admin, name: 'Admin', role: 'admin', isActive: true },
  ];
  state.shops = [
    { _id: ids.shopOne, owner: ids.vendorOne, shopName: 'Jute House', slug: 'jute-house', status: 'approved', isActive: true },
    { _id: ids.shopTwo, owner: ids.vendorTwo, shopName: 'Clay Studio', slug: 'clay-studio', status: 'approved', isActive: true },
  ];
  state.products = [
    { _id: ids.productOne, vendor: ids.vendorOne, shop: ids.shopOne, category: new mongoose.Types.ObjectId(), name: 'Woven Basket', slug: 'woven-basket', price: 100, stock: 5, images: ['https://images.example.test/basket.jpg'], status: 'approved', isActive: true, deletedAt: null },
    { _id: ids.productTwo, vendor: ids.vendorTwo, shop: ids.shopTwo, category: new mongoose.Types.ObjectId(), name: 'Clay Cup', slug: 'clay-cup', price: 50, stock: 8, images: [], status: 'approved', isActive: true, deletedAt: null },
    { _id: ids.inactiveProduct, vendor: ids.vendorOne, shop: ids.shopOne, name: 'Inactive', slug: 'inactive', price: 10, stock: 5, status: 'approved', isActive: false, deletedAt: null },
    { _id: ids.pendingProduct, vendor: ids.vendorOne, shop: ids.shopOne, name: 'Pending', slug: 'pending', price: 10, stock: 5, status: 'pending', isActive: true, deletedAt: null },
  ];
  state.parentOrders = [];
  state.vendorOrders = [];
  state.transactionsSupported = true;
  state.failProductId = null;
}

function mockDatabase(context) {
  context.mock.method(User, 'findById', (id) => memoryQuery(() => state.users.find((user) => same(user._id, id)) ?? null));
  context.mock.method(User, 'find', (filter) => memoryQuery(() => state.users.filter((user) => matches(user, filter))));
  context.mock.method(Shop, 'find', (filter) => memoryQuery(() => state.shops.filter((shop) => matches(shop, filter))));
  context.mock.method(Shop, 'exists', (filter) => Promise.resolve(state.shops.find((shop) => matches(shop, filter)) ?? null));
  context.mock.method(Product, 'find', (filter) => memoryQuery(() => state.products.filter((product) => matches(product, filter))));
  context.mock.method(Product, 'updateOne', async (filter, update) => {
    const product = state.products.find((item) => matches(item, filter));
    if (!product || same(product._id, state.failProductId)) return { matchedCount: 0, modifiedCount: 0 };
    product.stock += update.$inc.stock;
    return { matchedCount: 1, modifiedCount: 1 };
  });
  context.mock.method(ParentOrder, 'findOne', (filter) => memoryQuery(() => state.parentOrders.find((order) => matches(order, filter)) ?? null));
  context.mock.method(ParentOrder, 'findById', (id) => memoryQuery(() => state.parentOrders.find((order) => same(order._id, id)) ?? null));
  context.mock.method(ParentOrder, 'updateOne', async (filter, update) => {
    const order = state.parentOrders.find((entry) => matches(entry, filter));
    if (!order) return { matchedCount: 0, modifiedCount: 0 };
    if (update.$set) Object.assign(order, update.$set);
    if (update.$push?.statusHistory) order.statusHistory = [...(order.statusHistory ?? []), update.$push.statusHistory];
    return { matchedCount: 1, modifiedCount: 1 };
  });
  context.mock.method(ParentOrder, 'create', async (documents) => {
    const saved = [];
    for (const input of documents) {
      const document = new ParentOrder(input);
      await document.validate();
      state.parentOrders.push({ ...document.toObject(), createdAt: new Date(), updatedAt: new Date() });
      saved.push(document);
    }
    return saved;
  });
  context.mock.method(ParentOrder, 'countDocuments', async (filter) => state.parentOrders.filter((order) => matches(order, filter)).length);
  context.mock.method(ParentOrder, 'aggregate', async () => [{ totalOrderValue: state.parentOrders.reduce((sum, order) => sum + order.total, 0) }]);
  context.mock.method(ParentOrder, 'find', (filter) => memoryQuery((options) => sortAndPage(state.parentOrders.filter((order) => matches(order, filter)), options)));
  context.mock.method(VendorOrder, 'create', async (documents) => {
    const saved = [];
    for (const input of documents) {
      const document = new VendorOrder(input);
      await document.validate();
      state.vendorOrders.push({ ...document.toObject(), createdAt: new Date(), updatedAt: new Date() });
      saved.push(document);
    }
    return saved;
  });
  context.mock.method(VendorOrder, 'find', (filter) => memoryQuery((options) => sortAndPage(state.vendorOrders.filter((order) => matches(order, filter)), options)));
  context.mock.method(VendorOrder, 'findOne', (filter) => memoryQuery(() => state.vendorOrders.find((order) => matches(order, filter)) ?? null));
  context.mock.method(VendorOrder, 'updateOne', async (filter, update) => {
    const order = state.vendorOrders.find((entry) => matches(entry, filter));
    if (!order) return { matchedCount: 0, modifiedCount: 0 };
    if (update.$set) Object.assign(order, update.$set);
    if (update.$push?.statusHistory) order.statusHistory = [...(order.statusHistory ?? []), update.$push.statusHistory];
    return { matchedCount: 1, modifiedCount: 1 };
  });
  context.mock.method(VendorOrder, 'countDocuments', async (filter) => state.vendorOrders.filter((order) => matches(order, filter)).length);
  context.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async (callback) => {
      if (!state.transactionsSupported) {
        const error = new Error('Transaction numbers are only allowed on a replica set member or mongos.');
        error.code = 20;
        throw error;
      }
      const snapshot = {
        products: state.products.map((product) => ({ ...product })),
        parentOrders: state.parentOrders.map((order) => ({ ...order, statusHistory: [...(order.statusHistory ?? [])] })),
        vendorOrders: state.vendorOrders.map((order) => ({ ...order, statusHistory: [...(order.statusHistory ?? [])] })),
      };
      try { return await callback(); }
      catch (error) {
        state.products = snapshot.products;
        state.parentOrders = snapshot.parentOrders;
        state.vendorOrders = snapshot.vendorOrders;
        throw error;
      }
    },
    endSession: async () => {},
  }));
}

beforeEach((context) => {
  seed();
  originalJwtSecret = env.jwtSecret;
  env.jwtSecret = randomBytes(48).toString('hex');
  mockDatabase(context);
  context.after(() => { env.jwtSecret = originalJwtSecret; });
});

afterEach(() => seed());

async function withServer(context, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return callback(`http://127.0.0.1:${server.address().port}`);
}

function authToken(userId) { return createAccessToken(userId); }

async function request(baseUrl, path, { method = 'GET', userId, body, idempotencyKey, auth = true } = {}) {
  const headers = {};
  if (auth && userId) headers.authorization = `Bearer ${authToken(userId)}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${baseUrl}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { response, body: await response.json() };
}

const requestBody = {
  customerName: 'Nila Rahman',
  phone: '+880 1700 123456',
  deliveryAddress: { line1: '12 Lake Road', city: 'Dhanmondi', district: 'Dhaka', instructions: 'Call on arrival.' },
  paymentMethod: 'COD',
  items: [
    { productId: ids.productOne.toString(), quantity: 2 },
    { productId: ids.productTwo.toString(), quantity: 1 },
  ],
};
const IDEMPOTENCY_KEY = 'checkout-key-1234567890';

test('places a COD parent order, splits vendor orders, calculates 10% commission, and deducts stock', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(response.status, 201);
    const order = body.data.order;
    assert.match(order.orderNumber, /^BRZ/);
    assert.equal(order.paymentMethod, 'COD');
    assert.equal(order.status, 'PENDING');
    assert.equal(order.subtotal, 250);
    assert.equal(order.deliveryFee, 0);
    assert.equal(order.total, 250);
    assert.equal(order.commissionTotal, 25);
    assert.equal(order.vendorEarningsTotal, 225);
    assert.equal(order.vendorOrders.length, 2);
    assert.deepEqual(order.vendorOrders.map((item) => item.subtotal).sort((a, b) => a - b), [50, 200]);
    assert.equal(state.products.find((product) => same(product._id, ids.productOne)).stock, 3);
    assert.equal(state.products.find((product) => same(product._id, ids.productTwo)).stock, 7);
    assert.ok(state.vendorOrders.every((vendorOrder) => String(vendorOrder.parentOrder) === order.id));
  });
});

test('rejects unauthenticated, wrong-role, malformed, and client-priced checkout requests', async (context) => {
  await withServer(context, async (baseUrl) => {
    const unauthenticated = await request(baseUrl, '/api/orders', { method: 'POST', body: requestBody, auth: false });
    assert.equal(unauthenticated.response.status, 401);
    const wrongRole = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.vendorOne, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(wrongRole.response.status, 403);
    const invalidAddress = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: { ...requestBody, deliveryAddress: { ...requestBody.deliveryAddress, district: '' } }, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(invalidAddress.response.status, 400);
    const clientPrice = structuredClone(requestBody);
    clientPrice.items[0].price = 1;
    const priceAttempt = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: clientPrice, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(priceAttempt.response.status, 400);
    assert.equal(state.parentOrders.length, 0);
    assert.equal(state.products[0].stock, 5);
  });
});

test('rejects insufficient stock and products that are not approved and active', async (context) => {
  await withServer(context, async (baseUrl) => {
    const outOfStock = { ...requestBody, items: [{ productId: ids.productOne.toString(), quantity: 6 }] };
    const stockResponse = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: outOfStock, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(stockResponse.response.status, 409);
    for (const productId of [ids.inactiveProduct, ids.pendingProduct]) {
      const unavailable = { ...requestBody, items: [{ productId: productId.toString(), quantity: 1 }] };
      const result = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: unavailable, idempotencyKey: `${IDEMPOTENCY_KEY}-${productId.toString().slice(-4)}` });
      assert.equal(result.response.status, 409);
    }
    assert.equal(state.parentOrders.length, 0);
    assert.equal(state.products[0].stock, 5);
  });
});

test('same idempotency key replays the original order without another stock deduction', async (context) => {
  await withServer(context, async (baseUrl) => {
    const first = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const replay = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(first.response.status, 201);
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.data.replayed, true);
    assert.equal(replay.body.data.order.id, first.body.data.order.id);
    assert.equal(state.parentOrders.length, 1);
    assert.equal(state.vendorOrders.length, 2);
    assert.equal(state.products.find((product) => same(product._id, ids.productOne)).stock, 3);
  });
});

test('rolls back order records and earlier stock deductions when a later stock update fails', async (context) => {
  await withServer(context, async (baseUrl) => {
    state.failProductId = ids.productTwo;
    const result = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(result.response.status, 409);
    assert.equal(state.parentOrders.length, 0);
    assert.equal(state.vendorOrders.length, 0);
    assert.equal(state.products.find((product) => same(product._id, ids.productOne)).stock, 5);
    assert.equal(state.products.find((product) => same(product._id, ids.productTwo)).stock, 8);
  });
});

test('customers can only read their own parent orders', async (context) => {
  await withServer(context, async (baseUrl) => {
    const placed = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const orderId = placed.body.data.order.id;
    const owner = await request(baseUrl, `/api/orders/${orderId}`, { userId: ids.customer });
    const other = await request(baseUrl, `/api/orders/${orderId}`, { userId: ids.otherCustomer });
    assert.equal(owner.response.status, 200);
    assert.equal(owner.body.data.order.id, orderId);
    assert.equal(other.response.status, 404);
    const history = await request(baseUrl, '/api/orders', { userId: ids.otherCustomer });
    assert.equal(history.body.data.pagination.total, 0);
  });
});

test('vendors can only list and view their own vendor orders', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const ownList = await request(baseUrl, '/api/vendor/orders', { userId: ids.vendorOne });
    const otherList = await request(baseUrl, '/api/vendor/orders', { userId: ids.vendorTwo });
    assert.equal(ownList.body.data.orders.length, 1);
    assert.equal(otherList.body.data.orders.length, 1);
    assert.ok(ownList.body.data.orders[0].items.every((item) => item.vendor === ids.vendorOne.toString()));
    assert.ok(otherList.body.data.orders[0].items.every((item) => item.vendor === ids.vendorTwo.toString()));
    const stolen = await request(baseUrl, `/api/vendor/orders/${ownList.body.data.orders[0].id}`, { userId: ids.vendorTwo });
    assert.equal(stolen.response.status, 404);
    const wrongRole = await request(baseUrl, '/api/vendor/orders', { userId: ids.customer });
    assert.equal(wrongRole.response.status, 403);
  });
});

test('transaction-unavailable deployments fail safely without writing an order or stock', async (context) => {
  await withServer(context, async (baseUrl) => {
    state.transactionsSupported = false;
    const result = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    assert.equal(result.response.status, 503);
    assert.match(result.body.message, /requires MongoDB transactions/);
    assert.equal(state.parentOrders.length, 0);
    assert.equal(state.vendorOrders.length, 0);
    assert.equal(state.products[0].stock, 5);
    assert.equal(state.products[1].stock, 8);
  });
});

test('vendor lists only own orders and can search, filter, sort, and paginate them', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const all = await request(baseUrl, '/api/vendor/orders?sort=oldest&limit=1', { userId: ids.vendorOne });
    assert.equal(all.response.status, 200);
    assert.equal(all.body.data.pagination.total, 1);
    assert.equal(all.body.data.orders[0].items.length, 1);
    assert.equal(all.body.data.orders[0].items[0].vendor, ids.vendorOne.toString());
    const found = await request(baseUrl, `/api/vendor/orders?search=${all.body.data.orders[0].parentOrderNumber}&status=PENDING`, { userId: ids.vendorOne });
    assert.equal(found.body.data.orders.length, 1);
    assert.equal((await request(baseUrl, '/api/vendor/orders?status=UNKNOWN', { userId: ids.vendorOne })).response.status, 400);
  });
});

test('vendors can only read and update their own vendor orders', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const own = state.vendorOrders.find((order) => same(order.vendor, ids.vendorOne));
    const otherRead = await request(baseUrl, `/api/vendor/orders/${own._id}`, { userId: ids.vendorTwo });
    const otherUpdate = await request(baseUrl, `/api/vendor/orders/${own._id}/status`, { method: 'PATCH', userId: ids.vendorTwo, body: { status: 'CONFIRMED' } });
    assert.equal(otherRead.response.status, 404);
    assert.equal(otherUpdate.response.status, 404);
    assert.equal(own.status, 'PENDING');
  });
});

test('vendor status workflow validates transitions, records actors, and aggregates parent status', async (context) => {
  await withServer(context, async (baseUrl) => {
    const placed = await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const [vendorOneOrder, vendorTwoOrder] = state.vendorOrders;
    const firstConfirm = await request(baseUrl, `/api/vendor/orders/${vendorOneOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'CONFIRMED' } });
    assert.equal(firstConfirm.response.status, 200);
    assert.equal(state.parentOrders[0].status, 'PENDING');
    const invalidJump = await request(baseUrl, `/api/vendor/orders/${vendorOneOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'SHIPPED' } });
    assert.equal(invalidJump.response.status, 409);
    const invalidField = await request(baseUrl, `/api/vendor/orders/${vendorOneOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'CONFIRMED', paymentStatus: 'PAID' } });
    assert.equal(invalidField.response.status, 400);
    await request(baseUrl, `/api/vendor/orders/${vendorTwoOrder._id}/status`, { method: 'PATCH', userId: ids.vendorTwo, body: { status: 'CONFIRMED' } });
    assert.equal(state.parentOrders[0].status, 'CONFIRMED');
    await request(baseUrl, `/api/vendor/orders/${vendorOneOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'PROCESSING' } });
    await request(baseUrl, `/api/vendor/orders/${vendorTwoOrder._id}/status`, { method: 'PATCH', userId: ids.vendorTwo, body: { status: 'PROCESSING' } });
    assert.equal(state.parentOrders[0].status, 'PROCESSING');
    await request(baseUrl, `/api/vendor/orders/${vendorOneOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'SHIPPED' } });
    await request(baseUrl, `/api/vendor/orders/${vendorTwoOrder._id}/status`, { method: 'PATCH', userId: ids.vendorTwo, body: { status: 'SHIPPED' } });
    assert.equal(state.parentOrders[0].status, 'SHIPPED');
    await request(baseUrl, `/api/vendor/orders/${vendorOneOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'DELIVERED' } });
    await request(baseUrl, `/api/vendor/orders/${vendorTwoOrder._id}/status`, { method: 'PATCH', userId: ids.vendorTwo, body: { status: 'DELIVERED' } });
    assert.equal(state.parentOrders[0].status, 'DELIVERED');
    assert.ok(state.parentOrders[0].statusHistory.length >= 5);
    assert.ok(vendorOneOrder.statusHistory.some((entry) => entry.status === 'CONFIRMED' && String(entry.actor) === ids.vendorOne.toString() && entry.actorRole === 'vendor'));
    assert.equal(placed.body.data.order.commissionTotal, 25);
    assert.equal(vendorOneOrder.commissionTotal, 20);
    assert.equal(vendorOneOrder.vendorEarningsTotal, 180);
  });
});

test('vendor dashboard statistics are scoped to vendor and include cancelled/delivered counts', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    state.vendorOrders.find((order) => same(order.vendor, ids.vendorOne)).status = 'DELIVERED';
    state.vendorOrders.find((order) => same(order.vendor, ids.vendorTwo)).status = 'CANCELLED';
    const one = await request(baseUrl, '/api/vendor/orders/statistics', { userId: ids.vendorOne });
    const two = await request(baseUrl, '/api/vendor/orders/statistics', { userId: ids.vendorTwo });
    assert.deepEqual(one.body.data.statistics, { ALL: 1, PENDING: 0, CONFIRMED: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 1, CANCELLED: 0 });
    assert.deepEqual(two.body.data.statistics, { ALL: 1, PENDING: 0, CONFIRMED: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 1 });
  });
});

test('a vendor may cancel an unconfirmed order, and cancellation becomes terminal', async (context) => {
  await withServer(context, async (baseUrl) => {
    const oneItem = { ...requestBody, items: [{ productId: ids.productOne.toString(), quantity: 1 }] };
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: oneItem, idempotencyKey: IDEMPOTENCY_KEY });
    const vendorOrder = state.vendorOrders[0];
    const cancelled = await request(baseUrl, `/api/vendor/orders/${vendorOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'CANCELLED' } });
    assert.equal(cancelled.response.status, 200);
    assert.equal(state.parentOrders[0].status, 'CANCELLED');
    const terminal = await request(baseUrl, `/api/vendor/orders/${vendorOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'CONFIRMED' } });
    assert.equal(terminal.response.status, 409);
  });
});

test('admin order APIs require the admin role and return marketplace statistics and paginated global orders', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const stats = await request(baseUrl, '/api/admin/orders/statistics', { userId: ids.admin });
    assert.equal(stats.response.status, 200);
    assert.equal(stats.body.data.statistics.ALL, 1);
    assert.equal(stats.body.data.statistics.PENDING, 1);
    assert.equal(stats.body.data.statistics.totalOrderValue, 250);

    const listing = await request(baseUrl, '/api/admin/orders?page=1&limit=1&status=PENDING&sort=oldest&from=2020-01-01&to=2035-01-01', { userId: ids.admin });
    assert.equal(listing.response.status, 200);
    assert.equal(listing.body.data.pagination.total, 1);
    assert.equal(listing.body.data.orders[0].orderNumber, state.parentOrders[0].orderNumber);
    assert.deepEqual(listing.body.data.orders[0].vendorOrders.map((entry) => entry.vendor.name).sort(), ['Vendor One', 'Vendor Two']);

    for (const userId of [ids.customer, ids.vendorOne]) {
      const denied = await request(baseUrl, '/api/admin/orders', { userId });
      assert.equal(denied.response.status, 403);
    }
    const anonymous = await request(baseUrl, '/api/admin/orders', { auth: false });
    assert.equal(anonymous.response.status, 401);
  });
});

test('admin search finds orders by customer, vendor, shop, or order reference and validates filters', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    for (const search of ['Nila', 'Vendor One', 'Jute House', state.parentOrders[0].orderNumber]) {
      const result = await request(baseUrl, `/api/admin/orders?search=${encodeURIComponent(search)}`, { userId: ids.admin });
      assert.equal(result.response.status, 200, `search ${search}`);
      assert.equal(result.body.data.pagination.total, 1, `search ${search}`);
    }
    assert.equal((await request(baseUrl, '/api/admin/orders?from=2035-03-01&to=2035-02-01', { userId: ids.admin })).response.status, 400);
    assert.equal((await request(baseUrl, '/api/admin/orders?status=PAID', { userId: ids.admin })).response.status, 400);
  });
});

test('admin order details include customer, all vendor snapshots, financial snapshots, delivery, and history', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const orderId = state.parentOrders[0]._id.toString();
    const details = await request(baseUrl, `/api/admin/orders/${orderId}`, { userId: ids.admin });
    assert.equal(details.response.status, 200);
    assert.equal(details.body.data.order.customer.name, 'Nila Rahman');
    assert.equal(details.body.data.order.deliveryAddress.district, 'Dhaka');
    assert.equal(details.body.data.order.vendorOrders.length, 2);
    assert.equal(details.body.data.order.vendorOrders[0].items[0].commissionRate, 0.1);
    assert.ok(details.body.data.order.statusHistory.length > 0);
    assert.equal(Object.hasOwn(details.body.data.order, 'requestHash'), false);
  });
});

test('admin status changes follow workflow, record admin actor, and aggregate parent status transactionally', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/orders', { method: 'POST', userId: ids.customer, body: requestBody, idempotencyKey: IDEMPOTENCY_KEY });
    const firstVendorOrder = state.vendorOrders[0];
    const invalid = await request(baseUrl, `/api/admin/orders/vendor-orders/${firstVendorOrder._id}/status`, { method: 'PATCH', userId: ids.admin, body: { status: 'SHIPPED' } });
    assert.equal(invalid.response.status, 409);
    assert.equal(firstVendorOrder.status, 'PENDING');

    const updated = await request(baseUrl, `/api/admin/orders/vendor-orders/${firstVendorOrder._id}/status`, { method: 'PATCH', userId: ids.admin, body: { status: 'CONFIRMED' } });
    assert.equal(updated.response.status, 200);
    const updatedVendorOrder = state.vendorOrders.find((entry) => same(entry._id, firstVendorOrder._id));
    assert.equal(updatedVendorOrder.status, 'CONFIRMED', JSON.stringify(updated.body));
    const adminHistory = updatedVendorOrder.statusHistory.find((entry) => entry.status === 'CONFIRMED');
    assert.equal(String(adminHistory.actor), ids.admin.toString());
    assert.equal(adminHistory.actorRole, 'admin');
    assert.equal(state.parentOrders[0].status, 'PENDING');

    await request(baseUrl, `/api/admin/orders/vendor-orders/${state.vendorOrders[1]._id}/status`, { method: 'PATCH', userId: ids.admin, body: { status: 'CONFIRMED' } });
    assert.equal(state.parentOrders[0].status, 'CONFIRMED');
    const deniedVendor = await request(baseUrl, `/api/admin/orders/vendor-orders/${firstVendorOrder._id}/status`, { method: 'PATCH', userId: ids.vendorOne, body: { status: 'PROCESSING' } });
    const deniedCustomer = await request(baseUrl, `/api/admin/orders/vendor-orders/${firstVendorOrder._id}/status`, { method: 'PATCH', userId: ids.customer, body: { status: 'PROCESSING' } });
    assert.equal(deniedVendor.response.status, 403);
    assert.equal(deniedCustomer.response.status, 403);
  });
});
