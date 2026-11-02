import mongoose from 'mongoose';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import { assertJwtConfigured, createAccessToken } from './tokenService.js';
import { verifyPassword } from './passwordService.js';
import { toSafeUser } from '../utils/safeUser.js';
import { HttpError } from '../utils/httpError.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUserInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Name, email, and password are required.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined;

  if (!name || !email || !password) {
    throw new HttpError(400, 'Name, email, and password are required.');
  }
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be between 8 and 128 characters.');
  }
  if (name.length > 100 || (phone && phone.length > 30)) {
    throw new HttpError(400, 'Registration details are invalid.');
  }

  return { name, email, password, ...(phone ? { phone } : {}) };
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function isValidationError(error) {
  return error instanceof mongoose.Error.ValidationError;
}

function isTransactionUnavailable(error) {
  if (error?.code === 20 || error?.codeName === 'IllegalOperation') return true;
  const message = typeof error?.message === 'string' ? error.message : '';
  return /transactions? (?:are|is) only allowed|does not support transactions|replica set.*required/i.test(message);
}

function translateWriteError(error) {
  if (isDuplicateKey(error)) {
    throw new HttpError(409, 'Email or shop slug is already in use.');
  }
  if (isValidationError(error)) throw new HttpError(400, 'Registration details are invalid.');
  throw error;
}

function createAuthResult(user) {
  return {
    user: toSafeUser(user),
    token: createAccessToken(user._id ?? user.id),
  };
}

async function ensureEmailAvailable(email) {
  const existing = await User.findOne({ email });
  if (existing) throw new HttpError(409, 'Email is already registered.');
}

export async function registerCustomer(body) {
  assertJwtConfigured();
  const input = normalizeUserInput(body);
  await ensureEmailAvailable(input.email);

  const user = new User({ ...input, role: 'customer' });
  try {
    await user.save();
  } catch (error) {
    translateWriteError(error);
  }

  return createAuthResult(user);
}

function normalizeShopInput(body, userEmail) {
  const shop = body?.shop && typeof body.shop === 'object' ? body.shop : body;
  const shopName = typeof shop?.shopName === 'string' ? shop.shopName.trim() : '';
  const slug = typeof shop?.slug === 'string' ? shop.slug.trim().toLowerCase() : '';

  if (!shopName || !slug) {
    throw new HttpError(400, 'Shop name and shop slug are required for vendor registration.');
  }
  if (shopName.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, 'Shop details are invalid.');
  }

  const contactEmail = typeof shop.contactEmail === 'string'
    ? shop.contactEmail.trim().toLowerCase()
    : userEmail;
  const contactPhone = typeof shop.contactPhone === 'string' ? shop.contactPhone.trim() : undefined;
  const description = typeof shop.description === 'string' ? shop.description.trim() : undefined;

  return {
    shopName,
    slug,
    contactEmail,
    ...(contactPhone ? { contactPhone } : {}),
    ...(description ? { description } : {}),
    status: 'pending',
  };
}

async function saveVendorAndShop(input, shopInput, session) {
  const user = new User({ ...input, role: 'vendor' });
  await user.save(session ? { session } : undefined);

  const shop = new Shop({ ...shopInput, owner: user._id, status: 'pending' });
  await shop.save(session ? { session } : undefined);

  return { user, shop };
}

async function createVendorWithoutTransaction(input, shopInput) {
  const user = new User({ ...input, role: 'vendor' });
  await user.save();

  const shop = new Shop({ ...shopInput, owner: user._id, status: 'pending' });
  try {
    await shop.save();
    return { user, shop };
  } catch (error) {
    try {
      await User.deleteOne({ _id: user._id });
    } catch {
      throw new HttpError(500, 'Vendor registration failed and cleanup could not be confirmed.');
    }
    throw error;
  }
}

async function createVendorRecords(input, shopInput) {
  let session;
  let transactionError;
  let records;

  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      records = await saveVendorAndShop(input, shopInput, session);
    });
  } catch (error) {
    transactionError = error;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch {
        // Session cleanup errors must not expose driver details.
      }
    }
  }

  if (!transactionError) return records;
  if (isTransactionUnavailable(transactionError)) {
    return createVendorWithoutTransaction(input, shopInput);
  }
  throw transactionError;
}

export async function registerVendor(body) {
  assertJwtConfigured();
  const input = normalizeUserInput(body);
  const shopInput = normalizeShopInput(body, input.email);
  await ensureEmailAvailable(input.email);

  let records;
  try {
    records = await createVendorRecords(input, shopInput);
  } catch (error) {
    translateWriteError(error);
  }

  return {
    ...createAuthResult(records.user),
    shop: {
      id: String(records.shop._id ?? records.shop.id),
      shopName: records.shop.shopName,
      slug: records.shop.slug,
      status: records.shop.status,
    },
  };
}

export async function login(body) {
  assertJwtConfigured();
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) throw new HttpError(400, 'Email and password are required.');

  const query = User.findOne({ email });
  const user = await query.select('+password');
  if (!user || !user.isActive || !(await verifyPassword(password, user.password))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  return createAuthResult(user);
}

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,128}$/;

export async function changeAdminPassword(userId, body) {
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  if (!currentPassword || !newPassword) throw new HttpError(400, 'Current and new passwords are required.');
  if (!PASSWORD_POLICY.test(newPassword)) {
    throw new HttpError(400, 'New password must be 12–128 characters and include uppercase, lowercase, number, and symbol characters.');
  }
  if (currentPassword === newPassword) throw new HttpError(400, 'Choose a new password different from your current password.');

  const user = await User.findById(userId).select('+password');
  if (!user || !user.isActive || user.role !== 'admin') throw new HttpError(403, 'Admin access is required.');
  if (!(await verifyPassword(currentPassword, user.password))) throw new HttpError(401, 'Current password is incorrect.');

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  return toSafeUser(user);
}
