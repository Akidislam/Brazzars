import {
  getCustomerOrder,
  getVendorOrder,
  listCustomerOrders,
  listVendorOrders,
  placeCustomerOrder,
} from '../services/orderService.js';

export async function placeOrderController(req, res, next) {
  try {
    const result = await placeCustomerOrder(req.user.id, req.body, req.get('Idempotency-Key'));
    return res.status(result.replayed ? 200 : 201).json({ success: true, data: result });
  } catch (error) { return next(error); }
}

export async function listCustomerOrdersController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listCustomerOrders(req.user.id, req.query) }); }
  catch (error) { return next(error); }
}

export async function getCustomerOrderController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { order: await getCustomerOrder(req.user.id, req.params.id) } }); }
  catch (error) { return next(error); }
}

export async function listVendorOrdersController(req, res, next) {
  try { return res.status(200).json({ success: true, data: await listVendorOrders(req.user.id, req.query) }); }
  catch (error) { return next(error); }
}

export async function getVendorOrderController(req, res, next) {
  try { return res.status(200).json({ success: true, data: { order: await getVendorOrder(req.user.id, req.params.id) } }); }
  catch (error) { return next(error); }
}
