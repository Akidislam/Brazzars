import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Shop from '../src/models/Shop.js';
import { env } from '../src/config/env.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { authorizeRoles } from '../src/middleware/authorizeRoles.js';
import { provisionInitialAdmin } from '../src/services/adminProvisioningService.js';

const state = { users: [], shops: [], transactionAvailable: true, failShopSave: false };
let originalJwtSecret;

function queryResult(value) {
  return {
    select() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
    catch(reject) { return Promise.resolve(value).catch(reject); },
  };
}

function runSaveHooks(document) {
  return new Promise((resolve, reject) => {
    document.schema.s.hooks.execPre('save', document, [], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

beforeEach((context) => {
  state.users = [];
  state.shops = [];
  state.transactionAvailable = true;
  state.failShopSave = false;
  originalJwtSecret = env.jwtSecret;
  env.jwtSecret = randomBytes(48).toString('hex');

  context.mock.method(User, 'findOne', ({ email }) => queryResult(
    state.users.find((user) => user.email === email) ?? null,
  ));
  context.mock.method(User, 'findById', (id) => queryResult(
    state.users.find((user) => String(user._id) === String(id)) ?? null,
  ));
  context.mock.method(User, 'deleteOne', async ({ _id }) => {
    const initialLength = state.users.length;
    state.users = state.users.filter((user) => String(user._id) !== String(_id));
    return { deletedCount: initialLength - state.users.length };
  });
  context.mock.method(User.prototype, 'save', async function saveInMemory() {
    await this.validate();
    await runSaveHooks(this);
    const duplicate = this.isNew && state.users.some((user) => user.email === this.email);
    if (duplicate) {
      const error = new Error('Duplicate key');
      error.code = 11000;
      throw error;
    }
    this.isNew = false;
    const existingIndex = state.users.findIndex((user) => String(user._id) === String(this._id));
    if (existingIndex >= 0) state.users[existingIndex] = this;
    else state.users.push(this);
    return this;
  });
  context.mock.method(Shop.prototype, 'save', async function saveShopInMemory() {
    if (state.failShopSave) throw new Error('Simulated shop persistence failure');
    await this.validate();
    this.isNew = false;
    state.shops.push(this);
    return this;
  });
  context.mock.method(mongoose, 'startSession', async () => ({
    withTransaction: async (callback) => {
      if (!state.transactionAvailable) {
        const error = new Error('Transactions are not available on this test deployment.');
        error.code = 20;
        throw error;
      }
      return callback();
    },
    endSession: async () => {},
  }));
  context.after(() => { env.jwtSecret = originalJwtSecret; });
});

afterEach(() => {
  state.users = [];
  state.shops = [];
});

async function withServer(context, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  return callback(`http://127.0.0.1:${address.port}`);
}

async function post(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

test('customer registration normalizes email, ignores role input, and returns no password', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await post(baseUrl, '/api/auth/register', {
      name: 'Customer One', email: '  CUSTOMER@example.com ', password: 'correct-horse-password', role: 'admin',
    });

    assert.equal(response.status, 201);
    assert.equal(body.data.user.email, 'customer@example.com');
    assert.equal(body.data.user.role, 'customer');
    assert.equal(Object.hasOwn(body.data.user, 'password'), false);
    assert.equal(JSON.stringify(body).includes('correct-horse-password'), false);
    assert.match(state.users[0].password, /^scrypt\$16384\$8\$1\$/);
    assert.equal(state.users[0].password.includes('correct-horse-password'), false);
    assert.ok(body.data.token);
  });
});

test('duplicate email is rejected safely', async (context) => {
  await withServer(context, async (baseUrl) => {
    const registration = { name: 'Customer One', email: 'customer@example.com', password: 'correct-horse-password' };
    assert.equal((await post(baseUrl, '/api/auth/register', registration)).response.status, 201);
    const duplicate = await post(baseUrl, '/api/auth/register', { ...registration, email: 'CUSTOMER@example.com' });

    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.message, 'Email is already registered.');
    assert.equal(state.users.length, 1);
  });
});

test('vendor registration creates a vendor and pending shop transactionally', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await post(baseUrl, '/api/auth/register/vendor', {
      name: 'Vendor One', email: 'vendor@example.com', password: 'correct-horse-password', role: 'admin',
      shop: { shopName: 'Handmade Home', slug: 'handmade-home' },
    });

    assert.equal(response.status, 201);
    assert.equal(body.data.user.role, 'vendor');
    assert.equal(body.data.shop.status, 'pending');
    assert.equal(state.shops.length, 1);
    assert.equal(String(state.shops[0].owner), String(state.users[0]._id));
    assert.equal(Object.hasOwn(body.data.user, 'password'), false);
  });
});

test('vendor registration falls back safely when transactions are unavailable', async (context) => {
  state.transactionAvailable = false;
  await withServer(context, async (baseUrl) => {
    const { response, body } = await post(baseUrl, '/api/auth/register/vendor', {
      name: 'Vendor One', email: 'vendor@example.com', password: 'correct-horse-password',
      shop: { shopName: 'Handmade Home', slug: 'handmade-home' },
    });

    assert.equal(response.status, 201);
    assert.equal(body.data.shop.status, 'pending');
    assert.equal(state.users.length, 1);
    assert.equal(state.shops.length, 1);
  });
});

test('vendor fallback removes a created user if shop creation fails', async (context) => {
  state.transactionAvailable = false;
  state.failShopSave = true;
  await withServer(context, async (baseUrl) => {
    const { response, body } = await post(baseUrl, '/api/auth/register/vendor', {
      name: 'Vendor One', email: 'vendor@example.com', password: 'correct-horse-password',
      shop: { shopName: 'Handmade Home', slug: 'handmade-home' },
    });

    assert.equal(response.status, 500);
    assert.equal(body.message, 'Internal server error');
    assert.equal(state.users.length, 0);
    assert.equal(state.shops.length, 0);
  });
});

test('login verifies the existing scrypt password and returns a safe profile', async (context) => {
  await withServer(context, async (baseUrl) => {
    await post(baseUrl, '/api/auth/register', {
      name: 'Customer One', email: 'customer@example.com', password: 'correct-horse-password',
    });
    const { response, body } = await post(baseUrl, '/api/auth/login', {
      email: ' CUSTOMER@example.com ', password: 'correct-horse-password',
    });

    assert.equal(response.status, 200);
    assert.equal(body.data.user.email, 'customer@example.com');
    assert.equal(Object.hasOwn(body.data.user, 'password'), false);
    assert.equal(JSON.stringify(body).includes(state.users[0].password), false);

    const current = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${body.data.token}` },
    });
    assert.equal(current.status, 200);
    const currentBody = await current.json();
    assert.equal(currentBody.data.user.email, 'customer@example.com');
    assert.equal(Object.hasOwn(currentBody.data.user, 'password'), false);
  });
});

test('incorrect password and inactive account use generic login rejection', async (context) => {
  await withServer(context, async (baseUrl) => {
    await post(baseUrl, '/api/auth/register', {
      name: 'Customer One', email: 'customer@example.com', password: 'correct-horse-password',
    });
    const incorrect = await post(baseUrl, '/api/auth/login', {
      email: 'customer@example.com', password: 'wrong-password-value',
    });
    assert.equal(incorrect.response.status, 401);
    assert.equal(incorrect.body.message, 'Invalid email or password.');

    state.users[0].isActive = false;
    const inactive = await post(baseUrl, '/api/auth/login', {
      email: 'customer@example.com', password: 'correct-horse-password',
    });
    assert.equal(inactive.response.status, 401);
    assert.equal(inactive.body.message, incorrect.body.message);
  });
});

test('one-time Admin provisioning creates an admin with a scrypt hash and forced password change', async () => {
  const result = await provisionInitialAdmin();
  assert.equal(result.email, 'admin@gmail.com');
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].role, 'admin');
  assert.equal(state.users[0].mustChangePassword, true);
  assert.match(state.users[0].password, /^scrypt\$16384\$8\$1\$/);
  assert.equal(state.users[0].password.includes('admin1234'), false);
});

test('Admin provisioning refuses any existing account at the initial email without overwriting it', async () => {
  const existing = new User({ name: 'Existing account', email: 'admin@gmail.com', password: 'existing-password', role: 'customer' });
  existing.isNew = false;
  state.users.push(existing);
  await assert.rejects(provisionInitialAdmin(), { code: 'ADMIN_EMAIL_EXISTS' });
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].role, 'customer');
});

test('re-running one-time Admin provisioning cannot duplicate or reset the Admin', async () => {
  await provisionInitialAdmin();
  const originalHash = state.users[0].password;
  await assert.rejects(provisionInitialAdmin(), { code: 'ADMIN_EMAIL_EXISTS' });
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].password, originalHash);
});

test('Admin provisioning refuses an existing Vendor email without promoting the account', async () => {
  const existing = new User({ name: 'Existing vendor', email: 'admin@gmail.com', password: 'vendor-password', role: 'vendor' });
  existing.isNew = false;
  state.users.push(existing);
  await assert.rejects(provisionInitialAdmin(), { code: 'ADMIN_EMAIL_EXISTS' });
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].role, 'vendor');
});

test('provisioned Admin can authenticate and is required to change initial password', async (context) => {
  await provisionInitialAdmin();
  await withServer(context, async (baseUrl) => {
    const { response, body } = await post(baseUrl, '/api/auth/login', { email: 'ADMIN@gmail.com', password: 'admin1234' });
    assert.equal(response.status, 200);
    assert.equal(body.data.user.role, 'admin');
    assert.equal(body.data.user.mustChangePassword, true);
    assert.equal(JSON.stringify(body).includes('admin1234'), false);
    const incorrect = await post(baseUrl, '/api/auth/login', { email: 'admin@gmail.com', password: 'incorrect-admin-password' });
    assert.equal(incorrect.response.status, 401);
    assert.equal(incorrect.body.message, 'Invalid email or password.');
    const blocked = await fetch(`${baseUrl}/api/admin/orders/statistics`, { headers: { authorization: `Bearer ${body.data.token}` } });
    assert.equal(blocked.status, 403);
  });
});

test('Customer and Vendor accounts are denied from the Admin APIs', async (context) => {
  await withServer(context, async (baseUrl) => {
    for (const role of ['customer', 'vendor']) {
      const user = new User({ name: `${role} account`, email: `${role}@example.com`, password: 'account-password', role });
      await user.save();
      const loginResult = await post(baseUrl, '/api/auth/login', { email: user.email, password: 'account-password' });
      assert.equal(loginResult.response.status, 200);
      const response = await fetch(`${baseUrl}/api/admin/orders/statistics`, { headers: { authorization: `Bearer ${loginResult.body.data.token}` } });
      assert.equal(response.status, 403);
    }
  });
});

test('Admin password change checks current password, strength, and allows a new login', async (context) => {
  await provisionInitialAdmin();
  await withServer(context, async (baseUrl) => {
    const loginResult = await post(baseUrl, '/api/auth/login', { email: 'admin@gmail.com', password: 'admin1234' });
    const token = loginResult.body.data.token;
    const change = (body) => fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    const incorrect = await change({ currentPassword: 'wrong-initial', newPassword: 'ValidAdmin2026!Secure' });
    assert.equal(incorrect.status, 401);
    const weak = await change({ currentPassword: 'admin1234', newPassword: 'weakpassword' });
    assert.equal(weak.status, 400);
    const changed = await change({ currentPassword: 'admin1234', newPassword: 'ValidAdmin2026!Secure' });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).data.user.mustChangePassword, false);
    let authorizationError;
    await new Promise((resolve) => authorizeRoles('admin')({ user: state.users[0] }, {}, (error) => { authorizationError = error; resolve(); }));
    assert.equal(authorizationError, undefined);
    const subsequent = await post(baseUrl, '/api/auth/login', { email: 'admin@gmail.com', password: 'ValidAdmin2026!Secure' });
    assert.equal(subsequent.response.status, 200);
    assert.equal(subsequent.body.data.user.mustChangePassword, false);
  });
});

test('current-user endpoint rejects missing, invalid, expired, and inactive-user tokens', async (context) => {
  await withServer(context, async (baseUrl) => {
    await post(baseUrl, '/api/auth/register', {
      name: 'Customer One', email: 'customer@example.com', password: 'correct-horse-password',
    });
    const user = state.users[0];
    const missing = await fetch(`${baseUrl}/api/auth/me`);
    const invalid = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization: 'Bearer invalid-token' } });
    const expiredToken = jwt.sign({ sub: String(user._id) }, env.jwtSecret, {
      issuer: 'brazzars-api', audience: 'brazzars-client', expiresIn: -1, algorithm: 'HS256',
    });
    const expired = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization: `Bearer ${expiredToken}` } });

    assert.equal(missing.status, 401);
    assert.equal(invalid.status, 401);
    assert.equal(expired.status, 401);

    user.isActive = false;
    const inactiveToken = jwt.sign({ sub: String(user._id) }, env.jwtSecret, {
      issuer: 'brazzars-api', audience: 'brazzars-client', expiresIn: '5m', algorithm: 'HS256',
    });
    const inactive = await fetch(`${baseUrl}/api/auth/me`, { headers: { authorization: `Bearer ${inactiveToken}` } });
    assert.equal(inactive.status, 401);
  });
});

test('authorization uses the database-loaded role, not a role claim in a token', async () => {
  const user = new User({
    name: 'Customer One', email: 'customer@example.com', password: 'correct-horse-password', role: 'customer',
  });
  user.isNew = false;
  state.users.push(user);
  const token = jwt.sign({ sub: String(user._id), role: 'admin' }, env.jwtSecret, {
    issuer: 'brazzars-api', audience: 'brazzars-client', expiresIn: '5m', algorithm: 'HS256',
  });
  const req = { get: () => `Bearer ${token}` };
  let authError;
  await new Promise((resolve) => authenticate(req, {}, (error) => { authError = error; resolve(); }));
  assert.equal(authError, undefined);
  assert.equal(req.user.role, 'customer');

  let roleError;
  await new Promise((resolve) => authorizeRoles('vendor', 'admin')(req, {}, (error) => { roleError = error; resolve(); }));
  assert.equal(roleError.statusCode, 403);
});

test('health endpoints remain available', async (context) => {
  assert.equal(mongoose.connection.readyState, 0);
  await withServer(context, async (baseUrl) => {
    const apiHealth = await fetch(`${baseUrl}/api/health`);
    const databaseHealth = await fetch(`${baseUrl}/api/health/db`);
    assert.equal(apiHealth.status, 200);
    assert.equal(databaseHealth.status, 503);
    assert.equal((await apiHealth.json()).success, true);
    assert.equal((await databaseHealth.json()).database, 'disconnected');
  });
  assert.equal(mongoose.connection.readyState, 0);
});

test('registration fails before writing when JWT configuration is missing', async (context) => {
  env.jwtSecret = '';
  await withServer(context, async (baseUrl) => {
    const { response, body } = await post(baseUrl, '/api/auth/register', {
      name: 'Customer One', email: 'customer@example.com', password: 'correct-horse-password',
    });
    assert.equal(response.status, 500);
    assert.equal(body.message, 'Internal server error');
    assert.equal(state.users.length, 0);
  });
});
