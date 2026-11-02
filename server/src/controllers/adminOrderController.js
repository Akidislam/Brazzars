import {
  getAdminOrder,
  getAdminOrderStatistics,
  listAdminOrders,
  updateAdminVendorOrderStatus,
} from '../services/adminOrderService.js';

export async function getAdminOrderStatisticsController(_req, res, next) {
  try { return res.status(200).json({ success: true, data: { statistics: await getAdminOrderStatistics() } }); }
  catch (error) { return next(error); }
}

export async function listAdminOrdersController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listAdminOrders(req.query) }); }
  catch (error) { return next(error); }
}

export async function getAdminOrderController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { order: await getAdminOrder(req.params.id) } }); }
  catch (error) { return next(error); }
}

export async function updateAdminVendorOrderStatusController(req, res, next) {
  try {
    const order = await updateAdminVendorOrderStatus(req.user.id, req.params.vendorOrderId, req.body);
    return res.status(200).json({ success: true, data: { order } });
  } catch (error) { return next(error); }
}
