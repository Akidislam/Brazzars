import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Category from '../src/models/Category.js';
import User from '../src/models/User.js';
import { env } from '../src/config/env.js';
import { createAccessToken } from '../src/services/tokenService.js';

const state = { categories: [], users: [] };
let originalJwtSecret;

function query(valueFactory) {
  const options = { skip: 0, limit: Number.MAX_SAFE_INTEGER };
  return {
    select() { return this; },
    sort() { return this; },
    skip(value) { options.skip = value; return this; },
    limit(value) { options.limit = value; return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve().then(() => valueFactory(options)).then(resolve, reject); },
    catch(reject) { return Promise.resolve().then(() => valueFactory(options)).catch(reject); },
  };
}

function equal(left, right) { return String(left?._id ?? left) === String(right?._id ?? right); }
function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key];
    if (expected instanceof RegExp) return expected.test(actual ?? '');
    if (expected && typeof expected === 'object' && '$ne' in expected) return !equal(actual, expected.$ne);
    if (expected && typeof expected === 'object' && '$regex' in expected) return new RegExp(expected.$regex, expected.$options).test(actual ?? '');
    return equal(actual, expected);
  });
}

beforeEach((context) => {
  state.categories = [];
  state.users = [];
  originalJwtSecret = env.jwtSecret;
  env.jwtSecret = randomBytes(48).toString('hex');
  const users = new Map();
  context.mock.method(User, 'findById', (id) => query(() => users.get(String(id)) ?? null));
  context.mock.method(Category, 'find', (filter) => query(({ skip, limit }) => state.categories.filter((category) => matches(category, filter))
    .sort((a, b) => a.name.localeCompare(b.name)).slice(skip, skip + limit)));
  context.mock.method(Category, 'findOne', (filter) => query(() => state.categories.find((category) => matches(category, filter)) ?? null));
  context.mock.method(Category, 'findById', (id) => query(() => state.categories.find((category) => equal(category._id, id)) ?? null));
  context.mock.method(Category, 'countDocuments', (filter) => Promise.resolve(state.categories.filter((category) => matches(category, filter)).length));
  context.mock.method(Category.prototype, 'save', async function saveCategory() {
    await this.validate();
    if (this.isNew && state.categories.some((category) => category.slug === this.slug || (this.normalizedName && category.normalizedName === this.normalizedName))) {
      const duplicate = new Error('duplicate'); duplicate.code = 11000; throw duplicate;
    }
    this.isNew = false;
    const index = state.categories.findIndex((category) => equal(category._id, this._id));
    if (index < 0) state.categories.push(this); else state.categories[index] = this;
    return this;
  });
  context.after(() => { env.jwtSecret = originalJwtSecret; });
  state.userForRole = (role) => {
    const user = { _id: new mongoose.Types.ObjectId(), name: 'Test account', email: `${role}@example.com`, role, isActive: true, mustChangePassword: false };
    users.set(String(user._id), user);
    return createAccessToken(user._id);
  };
});

afterEach(() => { state.categories = []; state.users = []; });

async function withServer(context, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return callback(`http://127.0.0.1:${server.address().port}`);
}

async function request(baseUrl, path, { method = 'GET', body, role = 'admin' } = {}) {
  const token = state.userForRole(role);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, body: await response.json() };
}

test('Admin can create, retrieve, and update a category with a generated slug', async (context) => {
  await withServer(context, async (baseUrl) => {
    const created = await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: ' Home & Living ', description: 'Made for home', image: 'https://example.com/home.jpg' } });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.category.slug, 'home-living');
    assert.equal(created.body.data.category.isActive, true);
    const id = created.body.data.category.id;
    const retrieved = await request(baseUrl, `/api/admin/categories/${id}`);
    assert.equal(retrieved.response.status, 200);
    const updated = await request(baseUrl, `/api/admin/categories/${id}`, { method: 'PATCH', body: { name: 'Home and Living', slug: 'home-living', description: 'Updated description', image: '' } });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.category.name, 'Home and Living');
    assert.equal(updated.body.data.category.description, 'Updated description');
  });
});

test('Admin category directory includes inactive categories and searches names', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: 'Active Bags' } });
    const inactive = await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: 'Inactive Shoes' } });
    await request(baseUrl, `/api/admin/categories/${inactive.body.data.category.id}/status`, { method: 'PATCH', body: { isActive: false } });
    const all = await request(baseUrl, '/api/admin/categories');
    assert.equal(all.body.data.categories.length, 2);
    const search = await request(baseUrl, '/api/admin/categories?search=shoes');
    assert.deepEqual(search.body.data.categories.map((category) => category.name), ['Inactive Shoes']);
  });
});

test('Admin can deactivate and reactivate categories while inactive categories remain hidden publicly', async (context) => {
  await withServer(context, async (baseUrl) => {
    const created = await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: 'Travel Bags' } });
    const path = `/api/admin/categories/${created.body.data.category.id}/status`;
    const deactivated = await request(baseUrl, path, { method: 'PATCH', body: { isActive: false } });
    assert.equal(deactivated.body.data.category.isActive, false);
    const publicList = await fetch(`${baseUrl}/api/categories`);
    assert.equal((await publicList.json()).data.categories.length, 0);
    const reactivated = await request(baseUrl, path, { method: 'PATCH', body: { isActive: true } });
    assert.equal(reactivated.body.data.category.isActive, true);
    const visible = await fetch(`${baseUrl}/api/categories`);
    assert.equal((await visible.json()).data.categories[0].slug, 'travel-bags');
  });
});

test('category name and slug duplicates are rejected', async (context) => {
  await withServer(context, async (baseUrl) => {
    await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: 'Home Goods', slug: 'home-goods' } });
    const duplicateName = await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: 'HOME GOODS', slug: 'household' } });
    assert.equal(duplicateName.response.status, 409);
    const duplicateSlug = await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: 'Other category', slug: 'home-goods' } });
    assert.equal(duplicateSlug.response.status, 409);
  });
});

test('Customers and vendors cannot access category management APIs', async (context) => {
  await withServer(context, async (baseUrl) => {
    for (const role of ['customer', 'vendor']) {
      const denied = await request(baseUrl, '/api/admin/categories', { role });
      assert.equal(denied.response.status, 403);
      const createDenied = await request(baseUrl, '/api/admin/categories', { method: 'POST', role, body: { name: 'No access' } });
      assert.equal(createDenied.response.status, 403);
    }
    assert.equal(state.categories.length, 0);
  });
});

test('category management validates required data, IDs, and missing records', async (context) => {
  await withServer(context, async (baseUrl) => {
    assert.equal((await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: '  ' } })).response.status, 400);
    assert.equal((await request(baseUrl, '/api/admin/categories/not-an-id')).response.status, 400);
    assert.equal((await request(baseUrl, `/api/admin/categories/${new mongoose.Types.ObjectId()}`)).response.status, 404);
    const created = await request(baseUrl, '/api/admin/categories', { method: 'POST', body: { name: 'Validation target' } });
    assert.equal((await request(baseUrl, `/api/admin/categories/${created.body.data.category.id}/status`, { method: 'PATCH', body: { isActive: 'false' } })).response.status, 400);
  });
});
