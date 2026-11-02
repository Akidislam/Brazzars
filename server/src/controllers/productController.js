import {
  approveProduct,
  createVendorProduct,
  deleteVendorProduct,
  getPublicProductBySlug,
  getVendorProduct,
  listPendingProducts,
  listPublicProducts,
  listVendorProducts,
  rejectProduct,
  updateVendorProduct,
} from '../services/productService.js';

export async function createVendorProductController(req, res, next) {
  try { return res.status(201).json({ success: true, data: { product: await createVendorProduct(req.user.id, req.body) } }); }
  catch (error) { return next(error); }
}

export async function listVendorProductsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listVendorProducts(req.user.id, req.query) }); }
  catch (error) { return next(error); }
}

export async function getVendorProductController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { product: await getVendorProduct(req.user.id, req.params.id) } }); }
  catch (error) { return next(error); }
}

export async function updateVendorProductController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { product: await updateVendorProduct(req.user.id, req.params.id, req.body) } }); }
  catch (error) { return next(error); }
}

export async function deleteVendorProductController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await deleteVendorProduct(req.user.id, req.params.id) }); }
  catch (error) { return next(error); }
}

export async function listPendingProductsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listPendingProducts(req.query) }); }
  catch (error) { return next(error); }
}

export async function approveProductController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { product: await approveProduct(req.user.id, req.params.id) } }); }
  catch (error) { return next(error); }
}

export async function rejectProductController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { product: await rejectProduct(req.user.id, req.params.id, req.body) } }); }
  catch (error) { return next(error); }
}

export async function listPublicProductsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listPublicProducts(req.query) }); }
  catch (error) { return next(error); }
}

export async function getPublicProductController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { product: await getPublicProductBySlug(req.params.slug) } }); }
  catch (error) { return next(error); }
}
