import {
  getPublicCategoryBySlug,
  getPublicShopBySlug,
  listCategoryProducts,
  listPublicCategories,
  listPublicShops,
  listShopProducts,
} from '../services/discoveryService.js';

export async function listCategoriesController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listPublicCategories(req.query) }); }
  catch (error) { return next(error); }
}

export async function getCategoryController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { category: await getPublicCategoryBySlug(req.params.slug) } }); }
  catch (error) { return next(error); }
}

export async function listCategoryProductsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listCategoryProducts(req.params.slug, req.query) }); }
  catch (error) { return next(error); }
}

export async function listShopsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listPublicShops(req.query) }); }
  catch (error) { return next(error); }
}

export async function getShopController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { shop: await getPublicShopBySlug(req.params.slug) } }); }
  catch (error) { return next(error); }
}

export async function listShopProductsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listShopProducts(req.params.slug, req.query) }); }
  catch (error) { return next(error); }
}
