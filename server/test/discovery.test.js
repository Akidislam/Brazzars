import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import Shop from '../src/models/Shop.js';

const ids = {
  legacyShop: new mongoose.Types.ObjectId(),
  activeShop: new mongoose.Types.ObjectId(),
  inactiveShop: new mongoose.Types.ObjectId(),
  pendingShop: new mongoose.Types.ObjectId(),
  suspendedShop: new mongoose.Types.ObjectId(),
  vendorOne: new mongoose.Types.ObjectId(),
  vendorTwo: new mongoose.Types.ObjectId(),
  bags: new mongoose.Types.ObjectId(),
  shoes: new mongoose.Types.ObjectId(),
  hiddenCategory: new mongoose.Types.ObjectId(),
};

const state = { shops: [], categories: [], products: [] };

function equalValue(left, right) {
  return String(left?._id ?? left) === String(right?._id ?? right);
}

function matches(record, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key];
    if (expected === null) return actual === null || actual === undefined;
    if (expected && typeof expected === 'object' && '$ne' in expected) return !equalValue(actual, expected.$ne);
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.some((value) => equalValue(actual, value));
    if (expected && typeof expected === 'object' && '$regex' in expected) return new RegExp(expected.$regex, expected.$options).test(actual ?? '');
    if (expected && typeof expected === 'object' && ('$gte' in expected || '$lte' in expected)) {
      return ('$gte' in expected ? actual >= expected.$gte : true) && ('$lte' in expected ? actual <= expected.$lte : true);
    }
    return equalValue(actual, expected);
  });
}

function selectedFields(value, selection) {
  if (!value || typeof value !== 'object') return value;
  if (!selection) return { ...value };
  return Object.fromEntries(selection.split(/\s+/).filter(Boolean).map((field) => [field, value[field]]).filter(([, fieldValue]) => fieldValue !== undefined));
}

function query(valueFactory) {
  const options = { skip: 0, limit: Number.MAX_SAFE_INTEGER, sort: null, select: null, populate: [] };
  return {
    select(fields) { options.select = fields; return this; },
    populate(path, fields) { options.populate.push({ path, fields }); return this; },
    sort(sort) { options.sort = sort; return this; },
    skip(skip) { options.skip = skip; return this; },
    limit(limit) { options.limit = limit; return this; },
    lean() { return this; },
    then(resolve, reject) { return Promise.resolve().then(() => valueFactory(options)).then(resolve, reject); },
    catch(reject) { return Promise.resolve().then(() => valueFactory(options)).catch(reject); },
  };
}

function prepare(records, options) {
  const output = records.map((record) => {
    const result = { ...record };
    for (const { path, fields } of options.populate) {
      if (path === 'shop') {
        const related = state.shops.find((shop) => equalValue(shop._id, result.shop));
        result.shop = selectedFields(related, fields);
      } else if (path === 'category') {
        const related = state.categories.find((category) => equalValue(category._id, result.category));
        result.category = selectedFields(related, fields);
      }
    }
    return selectedFields(result, options.select);
  });
  return output;
}

function sortRecords(records, sort) {
  if (!sort) return records;
  const fields = Object.entries(sort);
  return records.sort((a, b) => {
    for (const [field, direction] of fields) {
      const left = a[field] instanceof Date ? a[field].getTime() : (a[field]?.toString?.() ?? a[field] ?? '');
      const right = b[field] instanceof Date ? b[field].getTime() : (b[field]?.toString?.() ?? b[field] ?? '');
      if (left === right) continue;
      return (left > right ? 1 : -1) * direction;
    }
    return 0;
  });
}

function mockReadModels(context) {
  context.mock.method(Shop, 'find', (filter) => query((options) => {
    const result = sortRecords(state.shops.filter((shop) => matches(shop, filter)), options.sort)
      .slice(options.skip, options.skip + options.limit);
    return prepare(result, options);
  }));
  context.mock.method(Shop, 'findOne', (filter) => query((options) => {
    const result = state.shops.find((shop) => matches(shop, filter));
    return result ? prepare([result], options)[0] : null;
  }));
  context.mock.method(Shop, 'countDocuments', (filter) => Promise.resolve(state.shops.filter((shop) => matches(shop, filter)).length));
  context.mock.method(Category, 'find', (filter) => query((options) => {
    const result = sortRecords(state.categories.filter((category) => matches(category, filter)), options.sort)
      .slice(options.skip, options.skip + options.limit);
    return prepare(result, options);
  }));
  context.mock.method(Category, 'findOne', (filter) => query((options) => {
    const result = state.categories.find((category) => matches(category, filter));
    return result ? prepare([result], options)[0] : null;
  }));
  context.mock.method(Category, 'countDocuments', (filter) => Promise.resolve(state.categories.filter((category) => matches(category, filter)).length));
  context.mock.method(Product, 'find', (filter) => query((options) => {
    const result = sortRecords(state.products.filter((product) => matches(product, filter)), options.sort)
      .slice(options.skip, options.skip + options.limit);
    return prepare(result, options);
  }));
  context.mock.method(Product, 'countDocuments', (filter) => Promise.resolve(state.products.filter((product) => matches(product, filter)).length));
}

function product({ name, slug, shop, category = ids.bags, status = 'approved', price, isActive, deletedAt, createdAt }) {
  return {
    _id: new mongoose.Types.ObjectId(),
    vendor: shop === ids.activeShop ? ids.vendorTwo : ids.vendorOne,
    shop,
    category,
    name,
    slug,
    description: `Description for ${name}`,
    price,
    stock: 4,
    images: [],
    status,
    ...(isActive !== undefined ? { isActive } : {}),
    ...(deletedAt !== undefined ? { deletedAt } : {}),
    createdAt: createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
}

function seed() {
  state.shops = [
    {
      _id: ids.legacyShop, owner: ids.vendorOne, shopName: 'Legacy Market', slug: 'legacy-market',
      status: 'approved', logo: 'https://images.example.test/legacy.png', description: 'Local bags',
      contactEmail: 'private@example.test', contactPhone: 'private-phone',
      address: { line1: 'Private street 12', city: 'Dhaka', district: 'Dhaka', country: 'Bangladesh', postalCode: '1000' },
    },
    { _id: ids.activeShop, owner: ids.vendorTwo, shopName: 'Active Market', slug: 'active-market', status: 'approved', isActive: true },
    { _id: ids.inactiveShop, owner: ids.vendorTwo, shopName: 'Inactive Market', slug: 'inactive-market', status: 'approved', isActive: false },
    { _id: ids.pendingShop, owner: ids.vendorOne, shopName: 'Pending Market', slug: 'pending-market', status: 'pending', isActive: true },
    { _id: ids.suspendedShop, owner: ids.vendorTwo, shopName: 'Suspended Market', slug: 'suspended-market', status: 'suspended', isActive: true },
  ];
  state.categories = [
    { _id: ids.bags, name: 'Bags', slug: 'bags', description: 'Bags and totes', image: 'https://images.example.test/bags.png', isActive: true },
    { _id: ids.shoes, name: 'Shoes', slug: 'shoes', isActive: true },
    { _id: ids.hiddenCategory, name: 'Hidden', slug: 'hidden', isActive: false },
  ];
  state.products = [
    product({ name: 'Canvas bag legacy', slug: 'canvas-bag-legacy', shop: ids.legacyShop, price: 100 }),
    product({ name: 'Leather bag active', slug: 'leather-bag-active', shop: ids.activeShop, price: 200, isActive: true, deletedAt: null, createdAt: new Date('2026-03-01T00:00:00.000Z') }),
    product({ name: 'Summer shoe', slug: 'summer-shoe', shop: ids.activeShop, category: ids.shoes, price: 300, isActive: true, deletedAt: null }),
    product({ name: 'Pending bag', slug: 'pending-bag', shop: ids.activeShop, price: 110, status: 'pending', isActive: true, deletedAt: null }),
    product({ name: 'Rejected bag', slug: 'rejected-bag', shop: ids.activeShop, price: 120, status: 'rejected', isActive: true, deletedAt: null }),
    product({ name: 'Inactive bag', slug: 'inactive-bag', shop: ids.activeShop, price: 130, isActive: false, deletedAt: null }),
    product({ name: 'Deleted bag', slug: 'deleted-bag', shop: ids.activeShop, price: 140, isActive: true, deletedAt: new Date() }),
    product({ name: 'Pending shop bag', slug: 'pending-shop-bag', shop: ids.pendingShop, price: 150, isActive: true, deletedAt: null }),
    product({ name: 'Inactive shop bag', slug: 'inactive-shop-bag', shop: ids.inactiveShop, price: 160, isActive: true, deletedAt: null }),
    product({ name: 'Suspended shop bag', slug: 'suspended-shop-bag', shop: ids.suspendedShop, price: 170, isActive: true, deletedAt: null }),
  ];
}

beforeEach((context) => {
  seed();
  mockReadModels(context);
});

afterEach(() => {
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
  return callback(`http://127.0.0.1:${server.address().port}`);
}

async function get(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { response, body: await response.json() };
}

test('category directory searches and paginates active categories only', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await get(baseUrl, '/api/categories?search=bag&page=1&limit=10');
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.categories.map((category) => category.slug), ['bags']);
    assert.equal(body.data.categories[0].description, 'Bags and totes');
    assert.equal(body.data.pagination.total, 1);
  });
});

test('category detail returns only active categories and reports bad or inactive slugs', async (context) => {
  await withServer(context, async (baseUrl) => {
    assert.equal((await get(baseUrl, '/api/categories/bags')).response.status, 200);
    assert.equal((await get(baseUrl, '/api/categories/hidden')).response.status, 404);
    assert.equal((await get(baseUrl, '/api/categories/not-a-slug!')).response.status, 400);
  });
});

test('category products apply public product and public shop visibility plus pagination/search/sort', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await get(baseUrl, '/api/categories/bags/products?search=bag&sort=price_asc&page=1&limit=1');
    assert.equal(response.status, 200);
    assert.equal(body.data.products.length, 1);
    assert.equal(body.data.products[0].name, 'Canvas bag legacy');
    assert.equal(body.data.pagination.total, 2);
    assert.equal(Object.hasOwn(body.data.products[0], 'vendor'), false);
  });
});

test('shop directory returns only approved active shops and omits private fields', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await get(baseUrl, '/api/shops?search=market&page=1&limit=10');
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.shops.map((shop) => shop.slug), ['active-market', 'legacy-market']);
    const legacy = body.data.shops.find((shop) => shop.slug === 'legacy-market');
    assert.deepEqual(legacy.address, { city: 'Dhaka', district: 'Dhaka', country: 'Bangladesh' });
    for (const forbidden of ['id', 'owner', 'contactEmail', 'contactPhone', 'status']) assert.equal(Object.hasOwn(legacy, forbidden), false);
    assert.equal(Object.hasOwn(legacy.address, 'line1'), false);
  });
});

test('shop detail requires approved active status and returns safe public information', async (context) => {
  await withServer(context, async (baseUrl) => {
    const visible = await get(baseUrl, '/api/shops/legacy-market');
    assert.equal(visible.response.status, 200);
    assert.equal(Object.hasOwn(visible.body.data.shop, 'contactEmail'), false);
    assert.equal((await get(baseUrl, '/api/shops/pending-market')).response.status, 404);
    assert.equal((await get(baseUrl, '/api/shops/inactive-market')).response.status, 404);
    assert.equal((await get(baseUrl, '/api/shops/suspended-market')).response.status, 404);
  });
});

test('shop products are scoped to the shop and can be filtered by category', async (context) => {
  await withServer(context, async (baseUrl) => {
    const { response, body } = await get(baseUrl, '/api/shops/active-market/products?category=shoes&sort=name_asc');
    assert.equal(response.status, 200);
    assert.deepEqual(body.data.products.map((item) => item.slug), ['summer-shoe']);
    assert.equal(body.data.pagination.total, 1);
    assert.equal((await get(baseUrl, '/api/shops/pending-market/products')).response.status, 404);
  });
});

test('global search works across approved vendors and supports category and shop filters', async (context) => {
  await withServer(context, async (baseUrl) => {
    const search = await get(baseUrl, '/api/products?search=bag');
    assert.equal(search.response.status, 200);
    assert.deepEqual(search.body.data.products.map((item) => item.slug).sort(), ['canvas-bag-legacy', 'leather-bag-active']);

    const filtered = await get(baseUrl, '/api/products?category=bags&shop=active-market');
    assert.deepEqual(filtered.body.data.products.map((item) => item.slug), ['leather-bag-active']);
    assert.equal((await get(baseUrl, '/api/products?shop=pending-market')).body.data.products.length, 0);
  });
});

test('global product search filters minimum/maximum price and validates ranges', async (context) => {
  await withServer(context, async (baseUrl) => {
    const filtered = await get(baseUrl, '/api/products?minPrice=150&maxPrice=250');
    assert.deepEqual(filtered.body.data.products.map((item) => item.slug), ['leather-bag-active']);
    assert.equal((await get(baseUrl, '/api/products?minPrice=300&maxPrice=100')).response.status, 400);
    assert.equal((await get(baseUrl, '/api/products?minPrice=-1')).response.status, 400);
  });
});

test('global listing supports all stable sorts and pagination', async (context) => {
  await withServer(context, async (baseUrl) => {
    const newest = await get(baseUrl, '/api/products?sort=newest&limit=10');
    const ascendingPrice = await get(baseUrl, '/api/products?sort=price_asc&limit=10');
    const descendingPrice = await get(baseUrl, '/api/products?sort=price_desc&limit=10');
    const ascendingName = await get(baseUrl, '/api/products?sort=name_asc&limit=10');
    const page = await get(baseUrl, '/api/products?page=2&limit=1');
    assert.equal(newest.body.data.products[0].slug, 'leather-bag-active');
    assert.equal(ascendingPrice.body.data.products[0].slug, 'canvas-bag-legacy');
    assert.equal(descendingPrice.body.data.products[0].slug, 'summer-shoe');
    assert.equal(ascendingName.body.data.products[0].name, 'Canvas bag legacy');
    assert.equal(page.body.data.products.length, 1);
    assert.equal(page.body.data.pagination.page, 2);
    assert.equal(page.body.data.pagination.total, 3);
  });
});
