import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/Product.js';
import Shop from '../src/models/Shop.js';
import User from '../src/models/User.js';
import { env } from '../src/config/env.js';
import { createAccessToken } from '../src/services/tokenService.js';

const state = { users: [], shops: [], products: [], tokens: new Map() };
let originalJwtSecret;

function equal(left, right) { return String(left?._id ?? left) === String(right?._id ?? right); }
function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some((clause) => matches(record, clause));
    const actual = record[key];
    if (expected && typeof expected === 'object' && '$ne' in expected) return !equal(actual, expected.$ne);
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.some((value) => equal(actual, value));
    if (expected && typeof expected === 'object' && '$regex' in expected) return new RegExp(expected.$regex, expected.$options).test(actual ?? '');
    if (expected === null) return actual == null;
    return equal(actual, expected);
  });
}

function query(valueFactory) {
  const options = { sort: null, skip: 0, limit: Number.MAX_SAFE_INTEGER };
  return {
    select() { return this; }, populate() { return this; }, lean() { return this; },
    sort(value) { options.sort = value; return this; },
    skip(value) { options.skip = value; return this; },
    limit(value) { options.limit = value; return this; },
    then(resolve, reject) { return Promise.resolve().then(() => valueFactory(options)).then(resolve, reject); },
    catch(reject) { return Promise.resolve().then(() => valueFactory(options)).catch(reject); },
  };
}

function sortAndSlice(records, { sort, skip, limit }) {
  const output = [...records];
  if (sort) {
    const [field, direction] = Object.entries(sort)[0] ?? [];
    if (field) output.sort((left, right) => {
      const a = left[field] instanceof Date ? left[field].getTime() : String(left[field] ?? '');
      const b = right[field] instanceof Date ? right[field].getTime() : String(right[field] ?? '');
      return (a > b ? 1 : a < b ? -1 : 0) * direction;
    });
  }
  return output.slice(skip, skip + limit);
}

beforeEach((context) => {
  state.users = []; state.shops = []; state.products = []; state.tokens = new Map();
  originalJwtSecret = env.jwtSecret;
  env.jwtSecret = randomBytes(48).toString('hex');
  context.mock.method(User, 'findById', (id) => query(() => state.users.find((user) => equal(user._id, id)) ?? null));
  context.mock.method(User, 'findOne', (filter) => query(() => state.users.find((user) => matches(user, filter)) ?? null));
  context.mock.method(User, 'find', (filter) => query((options) => sortAndSlice(state.users.filter((user) => matches(user, filter)), options)));
  context.mock.method(User, 'countDocuments', (filter) => Promise.resolve(state.users.filter((user) => matches(user, filter)).length));
  context.mock.method(Shop, 'find', (filter) => query((options) => sortAndSlice(state.shops.filter((shop) => matches(shop, filter)), options)));
  context.mock.method(Shop, 'findOne', (filter) => query((options) => sortAndSlice(state.shops.filter((shop) => matches(shop, filter)), { ...options, limit: 1 })[0] ?? null));
  context.mock.method(Shop, 'countDocuments', (filter) => Promise.resolve(state.shops.filter((shop) => matches(shop, filter)).length));
  context.mock.method(Shop, 'distinct', async (field, filter) => [...new Map(state.shops.filter((shop) => matches(shop, filter)).map((shop) => [String(shop[field]), shop[field]])).values()]);
  context.mock.method(Shop.prototype, 'save', async function saveInMemory() {
    await this.validate();
    this.isNew = false;
    const index = state.shops.findIndex((shop) => equal(shop._id, this._id));
    if (index < 0) state.shops.push(this); else state.shops[index] = this;
    return this;
  });
  context.mock.method(Product, 'find', (filter) => query((options) => sortAndSlice(state.products.filter((product) => matches(product, filter)), options)));
  context.mock.method(Product, 'countDocuments', (filter) => Promise.resolve(state.products.filter((product) => matches(product, filter)).length));
  context.after(() => { env.jwtSecret = originalJwtSecret; });
});

afterEach(() => { state.users = []; state.shops = []; state.products = []; state.tokens = new Map(); });

function addUser(role, details = {}) {
  const user = {
    _id: new mongoose.Types.ObjectId(), role, name: `${role} ${state.users.length + 1}`,
    email: `${role}${state.users.length + 1}@example.com`, phone: '01700123456', isActive: true,
    createdAt: new Date(Date.now() - state.users.length * 1000), password: 'private-password-hash', ...details,
  };
  state.users.push(user);
  const token = createAccessToken(user._id);
  state.tokens.set(token, user);
  return { user, token };
}

function addVendor({ status = 'pending', isActive = true, shopName, email, createdAt } = {}) {
  const { user } = addUser('vendor', { ...(email ? { email } : {}), ...(createdAt ? { createdAt } : {}) });
  const shop = new Shop({ owner: user._id, shopName: shopName ?? `${user.name} Shop`, slug: `shop-${String(user._id).slice(-6)}`, status, isActive, description: 'A local marketplace shop', contactEmail: user.email, contactPhone: user.phone, address: { line1: '12 Lake Road', city: 'Dhaka', district: 'Dhaka', country: 'Bangladesh' } });
  shop.isNew = false;
  state.shops.push(shop);
  return { user, shop };
}

async function withServer(context, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return callback(`http://127.0.0.1:${server.address().port}`);
}

async function call(baseUrl, path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, body: await response.json() };
}

test('Admin can list vendors with pagination, registration sorting, name/shop search, filters, and database statistics', async (context) => {
  const admin = addUser('admin');
  addVendor({ status: 'pending', shopName: 'River Crafts', createdAt: new Date('2026-01-01') });
  addVendor({ status: 'approved', isActive: false, shopName: 'Metro Goods', createdAt: new Date('2026-02-01') });
  addVendor({ status: 'rejected', shopName: 'Old Town Textiles', createdAt: new Date('2026-03-01') });
  await withServer(context, async (baseUrl) => {
    const result = await call(baseUrl, '/api/admin/vendors?search=river&status=pending&active=true&page=1&limit=1', { token: admin.token });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.data.vendors.length, 1);
    assert.equal(result.body.data.vendors[0].shop.shopName, 'River Crafts');
    assert.deepEqual(result.body.data.pagination, { page: 1, limit: 1, total: 1, pages: 1 });
    assert.deepEqual(result.body.data.statistics, { totalVendors: 3, pendingApproval: 1, approvedVendors: 1, rejectedVendors: 1, activeShops: 2, inactiveShops: 1 });
    const byEmail = await call(baseUrl, `/api/admin/vendors?search=${encodeURIComponent(state.users[1].email)}`, { token: admin.token });
    assert.equal(byEmail.body.data.vendors.length, 1);
    assert.equal((await call(baseUrl, '/api/admin/vendors?sort=oldest&page=1&limit=2', { token: admin.token })).body.data.vendors[0].name, state.users[1].name);
  });
});

test('Admin can view safe vendor and shop details without private authentication fields', async (context) => {
  const admin = addUser('admin');
  const { user, shop } = addVendor({ status: 'rejected' });
  shop.rejectionReason = 'Please update your store details.';
  shop.reviewedAt = new Date('2026-05-01');
  await withServer(context, async (baseUrl) => {
    const result = await call(baseUrl, `/api/admin/vendors/${user._id}`, { token: admin.token });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.data.vendor.email, user.email);
    assert.equal(result.body.data.vendor.shop.address.city, 'Dhaka');
    assert.equal(result.body.data.vendor.shop.rejectionReason, 'Please update your store details.');
    assert.equal(Object.hasOwn(result.body.data.vendor, 'password'), false);
    assert.equal(JSON.stringify(result.body).includes('private-password-hash'), false);
  });
});

test('Admin can approve pending and rejected shops without approving products', async (context) => {
  const admin = addUser('admin');
  const { user, shop } = addVendor({ status: 'pending' });
  state.products.push({ _id: new mongoose.Types.ObjectId(), shop: shop._id, category: new mongoose.Types.ObjectId(), name: 'Pending product', slug: 'pending-product', description: 'Not automatically approved', price: 100, stock: 2, images: [], status: 'pending', isActive: true, deletedAt: null, createdAt: new Date() });
  await withServer(context, async (baseUrl) => {
    const approved = await call(baseUrl, `/api/admin/vendors/${user._id}/approve`, { token: admin.token, method: 'PATCH' });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.data.vendor.shop.status, 'approved');
    assert.equal(String(shop.reviewedBy), String(admin.user._id));
    assert.ok(shop.reviewedAt instanceof Date);
    assert.equal(state.products[0].status, 'pending');
    shop.status = 'rejected';
    const reapproved = await call(baseUrl, `/api/admin/vendors/${user._id}/approve`, { token: admin.token, method: 'PATCH' });
    assert.equal(reapproved.response.status, 200);
    assert.equal(shop.rejectionReason, null);
  });
});

test('Admin can reject pending shops with a reason and rejected shops and products stay hidden publicly', async (context) => {
  const admin = addUser('admin');
  const { user, shop } = addVendor({ status: 'pending' });
  state.products.push({ _id: new mongoose.Types.ObjectId(), shop: shop._id, category: new mongoose.Types.ObjectId(), name: 'Approved product', slug: 'approved-product', description: 'Existing listing', price: 100, stock: 2, images: [], status: 'approved', isActive: true, deletedAt: null, createdAt: new Date() });
  await withServer(context, async (baseUrl) => {
    const invalid = await call(baseUrl, `/api/admin/vendors/${user._id}/reject`, { token: admin.token, method: 'PATCH', body: { reason: 'no' } });
    assert.equal(invalid.response.status, 400);
    const rejected = await call(baseUrl, `/api/admin/vendors/${user._id}/reject`, { token: admin.token, method: 'PATCH', body: { reason: 'Business details need correction.' } });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.body.data.vendor.shop.status, 'rejected');
    assert.equal(shop.rejectionReason, 'Business details need correction.');
    assert.equal((await (await fetch(`${baseUrl}/api/shops`)).json()).data.shops.length, 0);
    assert.equal((await (await fetch(`${baseUrl}/api/products`)).json()).data.products.length, 0);
  });
});

test('Admin can activate and deactivate approved shops; inactive shops and products are hidden', async (context) => {
  const admin = addUser('admin');
  const { user, shop } = addVendor({ status: 'approved' });
  state.products.push({ _id: new mongoose.Types.ObjectId(), shop: shop._id, category: new mongoose.Types.ObjectId(), name: 'Approved item', slug: 'approved-item', description: 'Visible listing', price: 120, stock: 2, images: [], status: 'approved', isActive: true, deletedAt: null, createdAt: new Date() });
  await withServer(context, async (baseUrl) => {
    const hidden = await call(baseUrl, `/api/admin/vendors/${user._id}/status`, { token: admin.token, method: 'PATCH', body: { isActive: false } });
    assert.equal(hidden.response.status, 200);
    assert.equal(hidden.body.data.vendor.shop.isActive, false);
    assert.equal((await (await fetch(`${baseUrl}/api/shops`)).json()).data.shops.length, 0);
    assert.equal((await (await fetch(`${baseUrl}/api/products`)).json()).data.products.length, 0);
    const visible = await call(baseUrl, `/api/admin/vendors/${user._id}/status`, { token: admin.token, method: 'PATCH', body: { isActive: true } });
    assert.equal(visible.response.status, 200);
    assert.equal(shop.isActive, true);
    assert.equal((await (await fetch(`${baseUrl}/api/shops`)).json()).data.shops.length, 1);
    const products = await fetch(`${baseUrl}/api/products`);
    assert.equal(products.status, 200);
    assert.equal((await products.json()).data.products.length, 1);
  });
});

test('Customers and vendors cannot access vendor management APIs or change shop approval', async (context) => {
  const { user } = addVendor({ status: 'pending' });
  const customer = addUser('customer');
  const vendor = state.users.find((entry) => entry.role === 'vendor');
  const vendorToken = [...state.tokens.entries()].find(([, entry]) => entry === vendor)?.[0];
  await withServer(context, async (baseUrl) => {
    for (const token of [customer.token, vendorToken]) {
      assert.equal((await call(baseUrl, '/api/admin/vendors', { token })).response.status, 403);
      assert.equal((await call(baseUrl, `/api/admin/vendors/${user._id}/approve`, { token, method: 'PATCH' })).response.status, 403);
    }
    assert.equal(state.shops[0].status, 'pending');
  });
});

test('vendor management validates IDs, filters, status transitions, and shop active input', async (context) => {
  const admin = addUser('admin');
  const { user } = addVendor({ status: 'pending' });
  await withServer(context, async (baseUrl) => {
    assert.equal((await call(baseUrl, '/api/admin/vendors?status=unknown', { token: admin.token })).response.status, 400);
    assert.equal((await call(baseUrl, '/api/admin/vendors/not-an-id', { token: admin.token })).response.status, 400);
    assert.equal((await call(baseUrl, `/api/admin/vendors/${new mongoose.Types.ObjectId()}`, { token: admin.token })).response.status, 404);
    assert.equal((await call(baseUrl, `/api/admin/vendors/${user._id}/status`, { token: admin.token, method: 'PATCH', body: { isActive: false } })).response.status, 409);
    assert.equal((await call(baseUrl, `/api/admin/vendors/${user._id}/status`, { token: admin.token, method: 'PATCH', body: { isActive: 'false' } })).response.status, 400);
    assert.equal((await call(baseUrl, `/api/admin/vendors/${user._id}/reject`, { token: admin.token, method: 'PATCH', body: { reason: '       ' } })).response.status, 400);
  });
});
