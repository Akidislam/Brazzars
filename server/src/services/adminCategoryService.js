import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { HttpError } from '../utils/httpError.js';
import { escapeSearch } from '../validators/productValidator.js';

const CATEGORY_FIELDS = 'name slug description image isActive createdAt updatedAt';
const ID_PATTERN = /^[a-f\d]{24}$/i;

function slugify(value) {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  return slug || 'category';
}

function normalizeText(value, field, max, { required = false } = {}) {
  if (value === undefined) {
    if (required) throw new HttpError(400, `${field} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text.`);
  const normalized = value.trim();
  if (required && !normalized) throw new HttpError(400, `${field} is required.`);
  if (normalized.length > max) throw new HttpError(400, `${field} must be no more than ${max} characters.`);
  return normalized;
}

function normalizeImage(value) {
  const image = normalizeText(value, 'Image', 2048);
  if (!image) return image;
  let url;
  try { url = new URL(image); } catch { throw new HttpError(400, 'Image must be a valid HTTP or HTTPS URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new HttpError(400, 'Image must be a valid HTTP or HTTPS URL.');
  return image;
}

function normalizeSlug(value, fallback) {
  if (value === undefined || value === '') return slugify(fallback);
  const slug = normalizeText(value, 'Slug', 120, { required: true });
  const normalized = slugify(slug);
  if (!normalized || normalized.length > 120) throw new HttpError(400, 'Slug is invalid.');
  return normalized;
}

function assertCategoryId(id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id) || !mongoose.isValidObjectId(id)) {
    throw new HttpError(400, 'Category ID is invalid.');
  }
}

function nameFilter(name, id) {
  const filter = { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  if (id) filter._id = { $ne: id };
  return filter;
}

async function ensureUnique(name, slug, id) {
  const duplicateName = await Category.findOne(nameFilter(name, id)).select('_id').lean();
  if (duplicateName) throw new HttpError(409, 'A category with this name already exists.');
  const duplicateSlug = await Category.findOne({ slug, ...(id ? { _id: { $ne: id } } : {}) }).select('_id').lean();
  if (duplicateSlug) throw new HttpError(409, 'A category with this slug already exists.');
}

function translateDuplicate(error) {
  if (error?.code === 11000) throw new HttpError(409, 'A category with this name or slug already exists.');
  throw error;
}

function categoryView(category) {
  return {
    id: String(category._id ?? category.id),
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    image: category.image ?? '',
    isActive: category.isActive !== false,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export async function listAdminCategories(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).some((key) => key !== 'search')) {
    throw new HttpError(400, 'Category filters are invalid.');
  }
  const search = escapeSearch(query.search);
  const filter = search ? { name: { $regex: search, $options: 'i' } } : {};
  const categories = await Category.find(filter).select(CATEGORY_FIELDS).sort({ name: 1, _id: 1 }).lean();
  return { categories: categories.map(categoryView) };
}

export async function getAdminCategory(id) {
  assertCategoryId(id);
  const category = await Category.findById(id).select(CATEGORY_FIELDS).lean();
  if (!category) throw new HttpError(404, 'Category not found.');
  return categoryView(category);
}

export async function createAdminCategory(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'A JSON object is required.');
  if (Object.keys(body).some((key) => !['name', 'slug', 'description', 'image'].includes(key))) throw new HttpError(400, 'The request contains unsupported category fields.');
  const name = normalizeText(body.name, 'Category name', 120, { required: true });
  const slug = normalizeSlug(body.slug, name);
  const description = normalizeText(body.description, 'Description', 1000);
  const image = normalizeImage(body.image);
  await ensureUnique(name, slug);
  const category = new Category({ name, normalizedName: name.toLowerCase(), slug, ...(description !== undefined ? { description } : {}), ...(image !== undefined ? { image } : {}), isActive: true });
  try { await category.save(); } catch (error) { translateDuplicate(error); }
  return categoryView(category);
}

export async function updateAdminCategory(id, body) {
  assertCategoryId(id);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'A JSON object is required.');
  if (Object.keys(body).some((key) => !['name', 'slug', 'description', 'image'].includes(key))) throw new HttpError(400, 'The request contains unsupported category fields.');
  const category = await Category.findById(id);
  if (!category) throw new HttpError(404, 'Category not found.');

  const name = body.name === undefined ? category.name : normalizeText(body.name, 'Category name', 120, { required: true });
  const slug = body.slug === undefined ? category.slug : normalizeSlug(body.slug, name);
  const description = body.description === undefined ? category.description : normalizeText(body.description, 'Description', 1000);
  const image = body.image === undefined ? category.image : normalizeImage(body.image);
  await ensureUnique(name, slug, id);
  category.name = name;
  category.normalizedName = name.toLowerCase();
  category.slug = slug;
  if (description !== undefined) category.description = description;
  if (image !== undefined) category.image = image;
  try { await category.save(); } catch (error) { translateDuplicate(error); }
  return categoryView(category);
}

export async function setAdminCategoryActive(id, isActive) {
  assertCategoryId(id);
  if (typeof isActive !== 'boolean') throw new HttpError(400, 'isActive must be true or false.');
  const category = await Category.findById(id);
  if (!category) throw new HttpError(404, 'Category not found.');
  category.isActive = isActive;
  await category.save();
  return categoryView(category);
}
