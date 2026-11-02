import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import Shop from '../src/models/Shop.js';
import User from '../src/models/User.js';
import { env } from '../src/config/env.js';
import { createAccessToken } from '../src/services/tokenService.js';

const ids = {
  vendor: new mongoose.Types.ObjectId(),
  otherVendor: new mongoose.Types.ObjectId(),
  customer: new mongoose.Types.ObjectId(),
  admin: new mongoose.Types.ObjectId(),
  shop: new mongoose.Types.ObjectId(),
  category: new mongoose.Types.ObjectId(),
  inactiveCategory: new mongoose.Types.ObjectId(),
};
const state = { users: [], shops: [], categories: [], products: [] };
let originalJwtSecret;

function query(valueFactory) {
  const options = { skip: 0, limit: Number.MAX_SAFE_INTEGER, sort: null };
  const result = {
    populate() { return this; },
    select() { return this; },
    lean() { return this; },
    sort(value) { options.sort = value; return this; },
    skip(value) { options.skip = value; return this; },
    limit(value) { options.limit = value; return this; },
    then(resolve, reject) { return Promise.resolve().then(() => valueFactory(options)).then(resolve, reject); },
    catch(reject) { return Promise.resolve().then(() => valueFactory(options)).catch(reject); },
  };
  return result;
}

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key];
    if (expected && typeof expected === 'object' && '$ne' in expected) return String(actual?._id ?? actual) !== String(expected.$ne);
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.some((value) => String(actual?._id ?? actual) === String(value?._id ?? value));
    if (expected && typeof expected === 'object' && '$regex' in expected) {
      return new RegExp(expected.$regex, expected.$options).test(record[key] ?? '');
    }
    if (expected === null) return actual === null || actual === undefined;
    return String(actual?._id ?? actual) === String(expected?._id ?? expected);
  });
}

function sortRecords(records, sort) {
  if (!sort) return records;
  const [[field, direction]] = Object.entries(sort);
  return records.sort((a, b) => {
    const left = a[field] instanceof Date ? a[field].getTime() : (a[field]?._id ?? a[field]);
    const right = b[field] instanceof Date ? b[field].getTime() : (b[field]?._id ?? b[field]);
    if (left === right) return 0;
    return (left > right ? 1 : -1) * direction;
  });
}

function makeProduct(input) {
  return new Product({
    vendor: ids.vendor,
    shop: ids.shop,
    category: ids.category,
    name: 'Canvas tote',
    slug: 'canvas-tote',
    description: 'A sturdy everyday tote',
    price: 25,
    stock: 5,
    ...input,
  });
}

function mockDatabase(context) {
  const vendorUser = { _id: ids.vendor, name: 'Vendor One', email: 'vendor@example.com', role: 'vendor', isActive: true };
  const otherVendorUser = { _id: ids.otherVendor, name: 'Vendor Two', email: 'other@example.com', role: 'vendor', isActive: true };
  const customerUser = { _id: ids.customer, name: 'Customer One', email: 'customer@example.com', role: 'customer', isActive: true };
  const adminUser = { _id: ids.admin, name: 'Admin One', email: 'admin@example.com', role: 'admin', isActive: true };
  state.users = [vendorUser, otherVendorUser, customerUser, adminUser];
  state.shops = [{ _id: ids.shop, owner: ids.vendor, shopName: 'Vendor Shop', slug: 'vendor-shop', status: 'approved' }];
  state.categories = [
    { _id: ids.category, name: 'Bags', slug: 'bags', isActive: true },
    { _id: ids.inactiveCategory, name: 'Hidden', slug: 'hidden', isActive: false },
  ];
  state.products = [];

  context.mock.method(User, 'findById', (id) => query(() => state.users.find((user) => String(user._id) === String(id)) ?? null));
  context.mock.method(Shop, 'findOne', (filter) => Promise.resolve(state.shops.find((shop) => matches(shop, filter)) ?? null));
  context.mock.method(Shop, 'find', (filter) => query(() => state.shops.filter((shop) => matches(shop, filter))));
  context.mock.method(Category, 'findOne', (filter) => Promise.resolve(state.categories.find((category) => matches(category, filter)) ?? null));
  context.mock.method(Product, 'exists', (filter) => Promise.resolve(state.products.some((product) => matches(product, filter))));
  context.mock.method(Product, 'findOne', (filter) => query(() => state.products.find((product) => matches(product, filter)) ?? null));
  context.mock.method(Product, 'find', (filter) => query((options) => {
    const products = sortRecords(state.products.filter((product) => matches(product, filter)), options.sort);
    return products.slice(options.skip, options.skip + options.limit);
  }));
  context.mock.method(Product, 'countDocuments', (filter) => Promise.resolve(state.products.filter((product) => matches(product, filter)).length));
  context.mock.method(Product.prototype, 'save', async function saveInMemory() {
    await this.validate();
    const index = state.products.findIndex((product) => String(product._id) === String(this._id));
    if (index === -1) state.products.push(this);
    else state.products[index] = this;
    this.isNew = false;
    return this;
  });
}

beforeEach((context) => {
  originalJwtSecret = env.jwtSecret;
  env.jwtSecret = randomBytes(48).toString('hex');
  mockDatabase(context);
  context.after(() => { env.jwtSecret = originalJwtSecret; });
});

afterEach(() => {
  state.users = [];
  state.shops = [];
  state.categories = [];
  state.products = [];
});

async function withServer(context, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const { port } = server.address();
  return callback(`http://127.0.0.1:${port}`);
}

function token(role) {
  const userId = ids[role];
  return createAccessToken(userId);
}

async function request(baseUrl, path, { method = 'GET', role, body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && role) headers.authorization = `Bearer ${token(role)}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { response, body: await response.json() };
}

const validInput = {
  name: 'Canvas Tote', description: 'A durable hand-made tote bag.', price: 25.5,
  category: ids.category.toString(), stock: 4, imageUrl: 'https://images.example.test/tote.jpg',
};

test('vendor creates a pending product with server-owned vendor, shop, and slug fields', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await request(baseUrl, '/api/vendor/products', {
      method: 'POST', role: 'vendor', body: { ...validInput, vendor: ids.otherVendor, shop: ids.otherVendor, status: 'approved' },
    });
    assert.equal(response.status, 400);
    assert.equal(state.products.length, 0);

    const created = await request(baseUrl, '/api/vendor/products', { method: 'POST', role: 'vendor', body: validInput });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.product.status, 'pending');
    assert.equal(created.body.data.product.vendor, ids.vendor.toString());
    assert.equal(created.body.data.product.shop, ids.shop.toString());
    assert.equal(created.body.data.product.slug, 'canvas-tote');
    assert.deepEqual(created.body.data.product.images, ['https://images.example.test/tote.jpg']);
    const duplicateName = await request(baseUrl, '/api/vendor/products', { method: 'POST', role: 'vendor', body: validInput });
    assert.equal(duplicateName.response.status, 201);
    assert.equal(duplicateName.body.data.product.slug, 'canvas-tote-2');
  });
});

test('vendor product creation requires a shop owned by the authenticated vendor', async (context) => {
  state.shops = [];
  await withServer(context, async (baseUrl) => {
    const result = await request(baseUrl, '/api/vendor/products', { method: 'POST', role: 'vendor', body: validInput });
    assert.equal(result.response.status, 404);
    assert.equal(state.products.length, 0);
  });
});

test('vendor endpoints reject unauthenticated users and customers', async (context) => {
  await withServer(context, async (baseUrl) => {
    const unauthenticated = await request(baseUrl, '/api/vendor/products', { auth: false });
    const customer = await request(baseUrl, '/api/vendor/products', { role: 'customer' });
    assert.equal(unauthenticated.response.status, 401);
    assert.equal(customer.response.status, 403);
  });
});

test('a vendor cannot access another vendor product and receives 404', async (context) => {
  const product = makeProduct({ vendor: ids.otherVendor, name: 'Private listing', slug: 'private-listing' });
  state.products.push(product);
  await withServer(context, async (baseUrl) => {
    const detail = await request(baseUrl, `/api/vendor/products/${product._id}`, { role: 'vendor' });
    const update = await request(baseUrl, `/api/vendor/products/${product._id}`, {
      method: 'PATCH', role: 'vendor', body: { stock: 10 },
    });
    assert.equal(detail.response.status, 404);
    assert.equal(update.response.status, 404);
    assert.equal(product.stock, 5);
  });
});

test('invalid price, stock, and inactive category are rejected', async (context) => {
  await withServer(context, async (baseUrl) => {
    const invalidPrice = await request(baseUrl, '/api/vendor/products', { method: 'POST', role: 'vendor', body: { ...validInput, price: 0 } });
    const invalidStock = await request(baseUrl, '/api/vendor/products', { method: 'POST', role: 'vendor', body: { ...validInput, stock: 1.2 } });
    const inactiveCategory = await request(baseUrl, '/api/vendor/products', {
      method: 'POST', role: 'vendor', body: { ...validInput, category: ids.inactiveCategory.toString() },
    });
    const missingCategory = await request(baseUrl, '/api/vendor/products', {
      method: 'POST', role: 'vendor', body: { ...validInput, category: new mongoose.Types.ObjectId().toString() },
    });
    assert.equal(invalidPrice.response.status, 400);
    assert.equal(invalidStock.response.status, 400);
    assert.equal(inactiveCategory.response.status, 400);
    assert.equal(missingCategory.response.status, 400);
    assert.equal(state.products.length, 0);
  });
});

test('product listing is owner-scoped, paginated, searchable, and filterable', async (context) => {
  for (const [name, slug, stock] of [['Canvas tote red', 'canvas-tote-red', 1], ['Canvas tote blue', 'canvas-tote-blue', 2], ['Leather wallet', 'leather-wallet', 3]]) {
    state.products.push(makeProduct({ name, slug, stock }));
  }
  const legacyProduct = makeProduct({ name: 'Canvas tote legacy', slug: 'canvas-tote-legacy' }).toObject();
  delete legacyProduct.isActive;
  delete legacyProduct.deletedAt;
  state.products.push(legacyProduct, makeProduct({ vendor: ids.otherVendor, name: 'Canvas tote private', slug: 'canvas-tote-private' }));
  await withServer(context, async (baseUrl) => {
    const { response, body } = await request(baseUrl, '/api/vendor/products?search=canvas&page=2&limit=1&isActive=true', { role: 'vendor' });
    assert.equal(response.status, 200);
    assert.equal(body.data.products.length, 1);
    assert.equal(body.data.pagination.page, 2);
    assert.equal(body.data.pagination.total, 3);
    assert.match(body.data.products[0].name, /canvas/i);
    assert.equal(body.data.products[0].vendor, ids.vendor.toString());
  });
});

test('significant edits return approved products to pending, while stock-only edits retain approval', async (context) => {
  const approved = makeProduct({ status: 'approved', reviewedBy: ids.admin, reviewedAt: new Date(), rejectionReason: null });
  const stockOnly = makeProduct({ name: 'Stock only item', slug: 'stock-only-item', status: 'approved', reviewedBy: ids.admin, reviewedAt: new Date() });
  state.products.push(approved, stockOnly);
  await withServer(context, async (baseUrl) => {
    const statusTamper = await request(baseUrl, `/api/vendor/products/${approved._id}`, {
      method: 'PATCH', role: 'vendor', body: { status: 'approved' },
    });
    assert.equal(statusTamper.response.status, 400);
    assert.equal(approved.status, 'approved');
    const contentEdit = await request(baseUrl, `/api/vendor/products/${approved._id}`, {
      method: 'PATCH', role: 'vendor', body: { price: 30 },
    });
    const stockEdit = await request(baseUrl, `/api/vendor/products/${stockOnly._id}`, {
      method: 'PATCH', role: 'vendor', body: { stock: 12 },
    });
    assert.equal(contentEdit.response.status, 200);
    assert.equal(contentEdit.body.data.product.status, 'pending');
    assert.equal(contentEdit.body.data.product.reviewedBy, null);
    assert.equal(stockEdit.response.status, 200);
    assert.equal(stockEdit.body.data.product.status, 'approved');
    assert.equal(stockEdit.body.data.product.stock, 12);
  });
});

test('soft-deleting a vendor product hides it from vendor details and public listing', async (context) => {
  const product = makeProduct({ status: 'approved' });
  state.products.push(product);
  await withServer(context, async (baseUrl) => {
    const deleted = await request(baseUrl, `/api/vendor/products/${product._id}`, { method: 'DELETE', role: 'vendor' });
    const detail = await request(baseUrl, `/api/vendor/products/${product._id}`, { role: 'vendor' });
    const listing = await request(baseUrl, '/api/products');
    assert.equal(deleted.response.status, 200);
    assert.equal(product.isActive, false);
    assert.ok(product.deletedAt instanceof Date);
    assert.equal(detail.response.status, 404);
    assert.equal(listing.body.data.products.length, 0);
  });
});

test('admin can approve and reject pending products; non-admin cannot review', async (context) => {
  const toApprove = makeProduct({ name: 'Approval item', slug: 'approval-item' });
  const toReject = makeProduct({ name: 'Rejection item', slug: 'rejection-item' });
  state.products.push(toApprove, toReject);
  await withServer(context, async (baseUrl) => {
    const pendingList = await request(baseUrl, '/api/admin/products/pending?page=1&limit=10', { role: 'admin' });
    assert.equal(pendingList.response.status, 200);
    assert.equal(pendingList.body.data.products.length, 2);
    const forbidden = await request(baseUrl, `/api/admin/products/${toApprove._id}/approve`, { method: 'PATCH', role: 'vendor' });
    const approved = await request(baseUrl, `/api/admin/products/${toApprove._id}/approve`, { method: 'PATCH', role: 'admin' });
    const rejected = await request(baseUrl, `/api/admin/products/${toReject._id}/reject`, { method: 'PATCH', role: 'admin', body: { reason: 'Image needs improvement.' } });
    assert.equal(forbidden.response.status, 403);
    assert.equal(approved.response.status, 200);
    assert.equal(toApprove.status, 'approved');
    assert.equal(String(toApprove.reviewedBy), ids.admin.toString());
    assert.ok(toApprove.reviewedAt instanceof Date);
    assert.equal(rejected.response.status, 200);
    assert.equal(toReject.status, 'rejected');
    assert.equal(toReject.rejectionReason, 'Image needs improvement.');
  });
});

test('public listing only exposes approved active products and supports search, pagination, and price sort', async (context) => {
  const legacyApproved = makeProduct({ name: 'Legacy approved bag', slug: 'legacy-approved-bag', status: 'approved', price: 5 }).toObject();
  delete legacyApproved.isActive;
  delete legacyApproved.deletedAt;
  state.products.push(
    makeProduct({ name: 'Public canvas bag', slug: 'public-canvas-bag', status: 'approved', price: 10 }),
    makeProduct({ name: 'Public leather bag', slug: 'public-leather-bag', status: 'approved', price: 20 }),
    legacyApproved,
    makeProduct({ name: 'Pending bag', slug: 'pending-bag', status: 'pending' }),
    makeProduct({ name: 'Rejected bag', slug: 'rejected-bag', status: 'rejected' }),
    makeProduct({ name: 'Inactive bag', slug: 'inactive-bag', status: 'approved', isActive: false }),
  );
  await withServer(context, async (baseUrl) => {
    const { response, body } = await request(baseUrl, '/api/products?search=bag&page=1&limit=1&sort=price_desc');
    assert.equal(response.status, 200);
    assert.equal(body.data.products.length, 1);
    assert.equal(body.data.products[0].name, 'Public leather bag');
    assert.equal(body.data.pagination.total, 3);
    assert.equal(Object.hasOwn(body.data.products[0], 'vendor'), false);
  });
});

test('public detail hides pending and missing products, but returns approved products', async (context) => {
  const pending = makeProduct({ status: 'pending' });
  const approved = makeProduct({ name: 'Visible bag', slug: 'visible-bag', status: 'approved' });
  state.products.push(pending, approved);
  await withServer(context, async (baseUrl) => {
    assert.equal((await request(baseUrl, `/api/products/${pending.slug}`, { auth: false })).response.status, 404);
    const visible = await request(baseUrl, '/api/products/visible-bag', { auth: false });
    assert.equal(visible.response.status, 200);
    assert.equal(visible.body.data.product.slug, 'visible-bag');
    assert.equal(Object.hasOwn(visible.body.data.product, 'vendor'), false);
    const visibleById = await request(baseUrl, `/api/products/id/${approved._id}`, { auth: false });
    assert.equal(visibleById.response.status, 200);
    assert.equal(visibleById.body.data.product.id, approved._id.toString());
    assert.equal((await request(baseUrl, `/api/products/id/${pending._id}`, { auth: false })).response.status, 404);
  });
});

test('invalid pagination, sort, and ObjectId are rejected without database mutations', async (context) => {
  await withServer(context, async (baseUrl) => {
    const badPage = await request(baseUrl, '/api/products?page=0');
    const excessivePage = await request(baseUrl, '/api/products?page=1000001');
    const badSort = await request(baseUrl, '/api/products?sort=password');
    const badId = await request(baseUrl, '/api/vendor/products/not-an-id', { role: 'vendor' });
    assert.equal(badPage.response.status, 400);
    assert.equal(excessivePage.response.status, 400);
    assert.equal(badSort.response.status, 400);
    assert.equal(badId.response.status, 400);
  });
});
