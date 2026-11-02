import mongoose from 'mongoose';

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export const addressSnapshotSchema = new mongoose.Schema({
  line1: { type: String, required: true, trim: true, maxlength: 180 },
  line2: { type: String, trim: true, maxlength: 180 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  district: { type: String, required: true, trim: true, maxlength: 100 },
  postalCode: { type: String, trim: true, maxlength: 20 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  instructions: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

export const orderLineSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  productSnapshot: {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, trim: true, maxlength: 180 },
    image: { type: String, trim: true, maxlength: 2048 },
  },
  shopSnapshot: {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, maxlength: 120 },
  },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, required: true, min: 0 },
  lineSubtotal: { type: Number, required: true, min: 0 },
  commissionRate: { type: Number, required: true, min: 0, max: 1 },
  commissionAmount: { type: Number, required: true, min: 0 },
  vendorEarnings: { type: Number, required: true, min: 0 },
}, { _id: false });

const parentOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerSnapshot: {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
  },
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 120 },
  requestHash: { type: String, required: true, select: false },
  items: { type: [orderLineSchema], required: true, validate: [(items) => items.length > 0, 'Order must contain at least one item.'] },
  deliveryAddress: { type: addressSnapshotSchema, required: true },
  paymentMethod: { type: String, enum: ['COD'], required: true, default: 'COD' },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  status: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
  statusHistory: [{
    status: { type: String, enum: ORDER_STATUSES, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, enum: ['customer', 'vendor', 'admin', 'system'], required: true },
  }],
  subtotal: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0, default: 0 },
  total: { type: Number, required: true, min: 0 },
  commissionTotal: { type: Number, required: true, min: 0 },
  vendorEarningsTotal: { type: Number, required: true, min: 0 },
}, { timestamps: true });

parentOrderSchema.index({ customer: 1, createdAt: -1 });
parentOrderSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });

const ParentOrder = mongoose.models.ParentOrder || mongoose.model('ParentOrder', parentOrderSchema);

export { ORDER_STATUSES };
export default ParentOrder;
