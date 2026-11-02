import {
  createAdminCategory,
  getAdminCategory,
  listAdminCategories,
  setAdminCategoryActive,
  updateAdminCategory,
} from '../services/adminCategoryService.js';

export async function listAdminCategoriesController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listAdminCategories(req.query) }); }
  catch (error) { return next(error); }
}

export async function getAdminCategoryController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { category: await getAdminCategory(req.params.id) } }); }
  catch (error) { return next(error); }
}

export async function createAdminCategoryController(req, res, next) {
  try { return res.status(201).json({ success: true, data: { category: await createAdminCategory(req.body) } }); }
  catch (error) { return next(error); }
}

export async function updateAdminCategoryController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { category: await updateAdminCategory(req.params.id, req.body) } }); }
  catch (error) { return next(error); }
}

export async function setAdminCategoryActiveController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { category: await setAdminCategoryActive(req.params.id, req.body?.isActive) } }); }
  catch (error) { return next(error); }
}
