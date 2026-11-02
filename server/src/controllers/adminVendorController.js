import {
  approveAdminVendor,
  getAdminVendor,
  listAdminVendors,
  rejectAdminVendor,
  setAdminVendorShopActive,
} from '../services/adminVendorService.js';

export async function listAdminVendorsController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listAdminVendors(req.query) }); }
  catch (error) { return next(error); }
}

export async function getAdminVendorController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { vendor: await getAdminVendor(req.params.id) } }); }
  catch (error) { return next(error); }
}

export async function approveAdminVendorController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { vendor: await approveAdminVendor(req.params.id, req.user.id) } }); }
  catch (error) { return next(error); }
}

export async function rejectAdminVendorController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { vendor: await rejectAdminVendor(req.params.id, req.user.id, req.body) } }); }
  catch (error) { return next(error); }
}

export async function setAdminVendorStatusController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { vendor: await setAdminVendorShopActive(req.params.id, req.body?.isActive) } }); }
  catch (error) { return next(error); }
}
