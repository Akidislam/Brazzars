import mongoose from 'mongoose';
import { addressSnapshotSchema, orderLineSchema, ORDER_STATUSES } from './ParentOrder.js';

const vendorOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  parentOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ParentOrder', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerSnapshot: {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
  },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  shopSnapshots: [{
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, maxlength: 120 },
  }],
  items: { type: [orderLineSchema], required: true },
  deliveryAddress: { type: addressSnapshotSchema, required: true },
  paymentMethod: { type: String, enum: ['COD'], required: true, default: 'COD' },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  status: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
  subtotal: { type: Number, required: true, min: 0 },
  commissionTotal: { type: Number, required: true, min: 0 },
  vendorEarningsTotal: { type: Number, required: true, min: 0 },
}, { timestamps: true });

vendorOrderSchema.index({ vendor: 1, createdAt: -1 });
vendorOrderSchema.index({ parentOrder: 1, vendor: 1 }, { unique: true });

const VendorOrder = mongoose.models.VendorOrder || mongoose.model('VendorOrder', vendorOrderSchema);

export default VendorOrder;
