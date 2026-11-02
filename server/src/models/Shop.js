import mongoose from 'mongoose';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, maxlength: 160 },
    line2: { type: String, trim: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 100, default: 'Bangladesh' },
  },
  { _id: false },
);

const shopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Shop owner is required.'],
      index: true,
    },
    shopName: {
      type: String,
      required: [true, 'Shop name is required.'],
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: [true, 'Shop slug is required.'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens in the slug.'],
      unique: true,
    },
    description: { type: String, trim: true, maxlength: 2000 },
    logo: { type: String, trim: true, maxlength: 2048 },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, 'Enter a valid contact email address.'],
    },
    contactPhone: { type: String, trim: true, maxlength: 30 },
    address: { type: addressSchema, default: undefined },
    status: {
      type: String,
      enum: ['pending', 'approved', 'suspended'],
      default: 'pending',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);

export default Shop;
