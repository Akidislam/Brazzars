import mongoose from 'mongoose';
import ParentOrder from '../models/ParentOrder.js';
import VendorOrder from '../models/VendorOrder.js';
import { HttpError } from '../utils/httpError.js';
import { validateVendorOrderStatus } from '../validators/orderValidator.js';

export const STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function aggregateParentStatus(vendorStatuses) {
  const active = vendorStatuses.filter((status) => status !== 'CANCELLED');
  if (!active.length) return 'CANCELLED';
  if (active.every((status) => status === 'DELIVERED')) return 'DELIVERED';
  const progress = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  return active.reduce((earliest, status) => progress.indexOf(status) < progress.indexOf(earliest) ? status : earliest, active[0]);
}

export function createStatusHistoryUpdate(order, status, actorId, actorRole) {
  const event = { status, changedAt: new Date(), actor: actorId, actorRole };
  if (order.statusHistory?.length) return { $push: { statusHistory: event }, $set: { status } };
  const priorEvent = { status: order.status, changedAt: order.createdAt ?? new Date(), actor: null, actorRole: 'system' };
  return { $set: { status, statusHistory: [priorEvent, event] } };
}

function transactionUnsupported(error) {
  return error?.code === 20 || error?.codeName === 'IllegalOperation'
    || /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(error?.message ?? '');
}

export async function transitionVendorOrderStatus({ orderId, vendorId, actorId, actorRole, body }) {
  if (!mongoose.isValidObjectId(orderId)) throw new HttpError(404, 'Order not found.');
  const nextStatus = validateVendorOrderStatus(body);
  const session = await mongoose.startSession();
  let parentOrderId;
  try {
    await session.withTransaction(async () => {
      const filter = { _id: orderId, ...(vendorId ? { vendor: vendorId } : {}) };
      const order = await VendorOrder.findOne(filter).session(session).lean();
      if (!order) throw new HttpError(404, 'Order not found.');
      if (!STATUS_TRANSITIONS[order.status]?.includes(nextStatus)) {
        throw new HttpError(409, `Order cannot move from ${order.status} to ${nextStatus}.`);
      }
      const updated = await VendorOrder.updateOne(
        { _id: order._id, status: order.status, ...(vendorId ? { vendor: vendorId } : {}) },
        createStatusHistoryUpdate(order, nextStatus, actorId, actorRole),
        { session },
      );
      if (updated.matchedCount !== 1) throw new HttpError(409, 'Order status changed. Refresh and try again.');

      const parentOrder = await ParentOrder.findById(order.parentOrder).session(session).lean();
      if (!parentOrder) throw new HttpError(409, 'The parent order could not be found.');
      const vendorOrders = await VendorOrder.find({ parentOrder: order.parentOrder }).session(session).lean();
      const parentStatus = aggregateParentStatus(vendorOrders.map((entry) => entry.status));
      if (parentStatus !== parentOrder.status) {
        const parentUpdated = await ParentOrder.updateOne(
          { _id: parentOrder._id, status: parentOrder.status },
          createStatusHistoryUpdate(parentOrder, parentStatus, actorId, actorRole),
          { session },
        );
        if (parentUpdated.matchedCount !== 1) throw new HttpError(409, 'Parent order status changed. Refresh and try again.');
      }
      parentOrderId = parentOrder._id;
    });
  } catch (error) {
    if (transactionUnsupported(error)) {
      throw new HttpError(503, 'Order status updates require MongoDB transactions, but transactions are unavailable. No status changes were committed.', { expose: true });
    }
    throw error;
  } finally { await session.endSession(); }
  return String(parentOrderId);
}
